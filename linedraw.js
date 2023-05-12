

export class LineDraw {
    constructor (canvas, linesPerFrame = 1000) {
        /** @type {HTMLCanvasElement} */
        this.canvas = canvas;
        this.lineQueue = [];
        this.lineCount = linesPerFrame;
    }

    async init () {
        this.adapter = await navigator.gpu.requestAdapter();
        this.device = await this.adapter.requestDevice();
        if (!this.device) {
            console.log('need a browser that supports WebGPU');
        }

        this.context = canvas.getContext('webgpu');

        this.presentationFormat = navigator.gpu.getPreferredCanvasFormat();
        this.context.configure({
            device: this.device,
            format: this.presentationFormat,
            alphaMode: "premultiplied",
        });

        this.module = this.device.createShaderModule({
            code: this.shader,
        });

        this.pipeline = this.device.createRenderPipeline({
            layout: "auto",
            vertex: {
                module: this.module,
                entryPoint: 'vs',
            },
            fragment: {
                module: this.module,
                entryPoint: 'fs',
                targets: [{ format: this.presentationFormat }, { format: 'rgba16float' }],
            }
        });

        this.sampler = this.device.createSampler()

        this.texture = this.device.createTexture({
            format: "rgba16float",
            size: [this.canvas.width, this.canvas.height],
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
        });

        this.outputTexture = this.device.createTexture({
            format: "rgba16float",
            size: [this.canvas.width, this.canvas.height],
            usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT
        });

        this.lines = new Float32Array(this.lineCount * 8)
        this.linesBuffer = this.device.createBuffer({
            mappedAtCreation: false,
            size: this.lines.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        this.device.queue.writeBuffer(this.linesBuffer, 0, this.lines);

        this.bindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: this.sampler },
                { binding: 1, resource: this.texture.createView() },
                { binding: 2, resource: { buffer: this.linesBuffer } },
            ],
        });

        this.renderPassDescriptor = {
            colorAttachments: [
                {
                    // view: <- to be filled out when we render
                    clearValue: [0, 0, 0, 1],
                    loadOp: 'clear',
                    storeOp: 'store',
                },
                {
                    view: this.outputTexture.createView(),
                    loadOp: 'clear',
                    storeOp: 'store',
                }
            ],
        };
    }

    async render () {
        let time = performance.now();

        this.renderPassDescriptor.colorAttachments[0].view = this.context.getCurrentTexture().createView();
    
        this.encoder = this.device.createCommandEncoder();
        this.pass = this.encoder.beginRenderPass(this.renderPassDescriptor);
        this.pass.setPipeline(this.pipeline);
        this.pass.setBindGroup(0, this.bindGroup);
        this.pass.draw(3);
        this.pass.end();
    
        this.encoder.copyTextureToTexture({ texture: this.outputTexture }, { texture: this.texture }, [this.canvas.width, this.canvas.height])
    
        this.commandBuffer = this.encoder.finish();
        this.device.queue.submit([this.commandBuffer]);

        this.lines.fill(0);
        this.device.queue.writeBuffer(this.linesBuffer, 0, this.lines);    
    
        await this.device.queue.onSubmittedWorkDone();
    
        // console.log(performance.now() - time);
    }

    addToQueue (line) {
        // [x1, y1, x2, y2, r, g, b, a]
        this.lineQueue.push(...line);
    }

    draw() {
        return new Promise((resolve, reject) => {
            let loop = async () => {
                console.log(this.lineQueue.length)
                if (this.lineQueue.length < 8) {
                    resolve();
                    return;
                }
                let lines = this.lineQueue.splice(0, this.lineCount * 8);
                this.lines.set(lines);
                this.device.queue.writeBuffer(this.linesBuffer, 0, this.lines);
                await this.render();
                requestAnimationFrame(loop);
            }
            loop();
        });
    }
    

    get shader() {
        return `
        struct OurVertexShaderOutput {
            @builtin(position) position: vec4f,
            @location(0) texcoord: vec2f,
        };
        
        @vertex fn vs(
            @builtin(vertex_index) vertexIndex : u32
        ) -> OurVertexShaderOutput {
            var pos = array<vec2f, 3>(
            // 1st triangle
            vec2f( -1.0,  -1.0),  // center
            vec2f( 3.0,  -1.0),  // right, center
            vec2f( -1.0,  3.0),  // center, top
            );
        
            var vsOutput: OurVertexShaderOutput;
            let xy = pos[vertexIndex];
            vsOutput.position = vec4f(xy, 0.0, 1.0);
            vsOutput.texcoord = (xy - vec2f(-1.0, -1.0)) / 2.0;
            return vsOutput;
        };
        
        struct Line {
            a: vec2f,
            b: vec2f,
            color: vec4f,
        };
        
        fn sdfLineSegment(p: vec2f, a: vec2f, b: vec2f) -> f32 {
            let pa = p - a;
            let ba = b - a;
            let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
            return length(pa - ba * h);
        }
        
        struct Out {
            @location(0) a: vec4f,
            @location(1) b: vec4f,
        }
        
        @group(0) @binding(0) var ourSampler: sampler;
        @group(0) @binding(1) var ourTexture: texture_2d<f32>;
        @group(0) @binding(2) var<storage, read_write> lines: array<Line>;
        
        @fragment fn fs(fsInput: OurVertexShaderOutput) -> Out {
            let length: u32 = arrayLength(&lines);
        
            var uv = fsInput.texcoord;
            uv.y = 1.0 - uv.y;
            let pos = fsInput.position.xy;
        
            var color = textureSample(ourTexture, ourSampler, uv);
        
            for (var i: u32 = 0; i < length; i += 1) {
                let line = lines[i];
                let d = sdfLineSegment(pos, line.a, line.b);
                if (d <= .5) {
                    color += vec4f(line.color.xyz * line.color.a, line.color.a);
                }
            }
        
            return Out(color, color);
        }`
    }
}

// let linedrawer = new LineDraw(document.getElementById('canvas'), 1000);
// canvas.width = 1000;
// canvas.height = 1000;
// await linedrawer.init();

// let count = 10000;
// for (let i = 0; i < count; i++) {
//     linedrawer.addToQueue([
//         Math.random() * linedrawer.canvas.width,
//         Math.random() * linedrawer.canvas.height,
//         Math.random() * linedrawer.canvas.width,
//         Math.random() * linedrawer.canvas.height,
//         Math.random(),
//         Math.random(),
//         Math.random(),
//         Math.random() * 0.01,
//     ]);
// }

// let t = performance.now();
// console.log(await linedrawer.draw())
// console.log(performance.now() - t)
// console.log('done')