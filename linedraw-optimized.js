

export class LineDraw {
    constructor (canvas, linesPerFrame = 1000) {
        /** @type {HTMLCanvasElement} */
        this.canvas = canvas;
        this.lineQueue = [];
        this.lineCount = linesPerFrame;
    }

    async init () {
        if (!navigator.gpu) {
            alert("WebGPU not supported. Will not work")
        }        
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

        // src is r, dst is r2
        // 1 * r2 + a * r
        let blend = {
            alpha: {
                dstFactor: "one",
                operation: "add",
                srcFactor: "one",
            },
            color: {
                dstFactor: "one",
                operation: "add",
                srcFactor: "one",
            }
        }

        this.pipeline = this.device.createRenderPipeline({
            layout: "auto",
            vertex: {
                module: this.module,
                entryPoint: 'vs',
            },
            fragment: {
                module: this.module,
                entryPoint: 'fs',
                targets: [
                    { 
                        format: this.presentationFormat, 
                        blend: blend,
                    }, 
                    { 
                        format: 'rgba16float',
                        blend: blend,
                    }
                ],
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
                    clearValue: [0, 0, 0, 0],
                    loadOp: 'clear',
                    storeOp: 'store',
                },
                {
                    clearValue: [0, 0, 0, 0],
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
        this.pass.setBlendConstant([1.0, 1.0, 1.0, 1.0])
        this.pass.setPipeline(this.pipeline);
        this.pass.setBindGroup(0, this.bindGroup);
        this.pass.draw(6, this.lineCount + 1);
        this.pass.end();
    
        this.encoder.copyTextureToTexture({ texture: this.outputTexture }, { texture: this.texture }, [this.canvas.width, this.canvas.height])
    
        this.commandBuffer = this.encoder.finish();
        this.device.queue.submit([this.commandBuffer]);

        this.lines.fill(0);
        this.device.queue.writeBuffer(this.linesBuffer, 0, this.lines);
    
        // await this.device.queue.onSubmittedWorkDone();
    
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
        return /*wgsl*/ `
        struct OurVertexShaderOutput {
            @builtin(position) position: vec4f,
            @location(0) texcoord: vec2f,
            @location(1) color: vec4f,
            @location(2) a: vec2f,
            @location(3) b: vec2f,
            @location(4) isThing: f32,
        };

        fn mapRange(value: f32, low1: f32, high1: f32, low2: f32, high2: f32) -> f32 {
            return low2 + (high2 - low2) * (value - low1) / (high1 - low1);
        }

        struct Vertex {
            @builtin(vertex_index) vertexIndex : u32,
            @builtin(instance_index) instanceIndex: u32,
        };          
        
        @vertex fn vs(
           vert: Vertex
        ) -> OurVertexShaderOutput {
            // var pos = array<vec2f, 3>(
            // vec2f( 0,  0),  // center
            // vec2f( 1,  0),  // right, center
            // vec2f( 0,  .1),  // center, top
            // );
        
            var vsOutput: OurVertexShaderOutput;
            // let xy = pos[vert.vertexIndex];
            if (vert.instanceIndex == 0) {
                var pos = array<vec2f, 6>(
                   vec2f(-1, -1),
                   vec2f(-1, 1),
                   vec2f(1, -1),
                   vec2f(1, 1),
                   vec2f(-1, 1),
                   vec2f(1, -1),
                );
                let xy = pos[vert.vertexIndex];
                vsOutput.position = vec4f(xy, 0.0, 1.0);
                vsOutput.texcoord = (xy - vec2f(-1.0, -1.0)) / 2.0;
                vsOutput.isThing = 1;
                // vsOutput.color = line.color;
                return vsOutput;    
            }
            
            let line = lines[vert.instanceIndex - 1];
            var xy: vec2f;
            let normal = normalize(vec2f(
                -(line.a.y - line.b.y),
                line.a.x - line.b.x)
            ) * .5 * 1;
            if (vert.vertexIndex == 0) {
                xy = line.a + normal;
            } else if (vert.vertexIndex == 1) {
                xy = line.a - normal;
            } else if (vert.vertexIndex == 2) {
                xy = line.b + normal;
            } else if (vert.vertexIndex == 3) {
                xy = line.b + normal;
            } else if (vert.vertexIndex == 4) {
                xy = line.b - normal;
            } else if (vert.vertexIndex == 5) {
                xy = line.a - normal;
            }
            xy = vec2f(
                mapRange(xy.x, 0, 1000, -1, 1),
                mapRange(xy.y, 0, 1000, 1, -1)
            );

            vsOutput.position = vec4f(xy, 0.0, 1.0);
            vsOutput.texcoord = (xy - vec2f(-1.0, -1.0)) / 2.0;
            vsOutput.color = line.color;
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

        fn sdfLineSegmentSquared(p: vec2f, a: vec2f, b: vec2f) -> f32 {
            let pa = p - a;
            let ba = b - a;
            let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
            let v = (pa - ba * h);
            return (v.x * v.x) + (v.y * v.y);
        }
        
        struct Out {
            @location(0) a: vec4f,
            @location(1) b: vec4f,
        }

        
        @group(0) @binding(0) var ourSampler: sampler;
        @group(0) @binding(1) var ourTexture: texture_2d<f32>;
        @group(0) @binding(2) var<storage, read> lines: array<Line>;
        
        @fragment fn fs(fsInput: OurVertexShaderOutput) -> Out {
            let length: u32 = arrayLength(&lines);
        
            var uv = fsInput.texcoord;
            uv.y = 1.0 - uv.y;
            var pos = fsInput.position.xy;
            pos.y = 1000.0 - pos.y;
        
            var color = textureSample(ourTexture, ourSampler, uv);
            // color = vec4f(0);
            if (fsInput.isThing != 0) {
                // color = vec4f(0);
                // if (all(color != vec4f(0))) {
                //     // color.r = color.a;
                //     // color.g = 0;
                //     // color.b = 0;
                //     // color.a = 1;
                //     // color = vec4f(0);
                // }
                // ;
                // color = vec4f(1,0,0,1);
            } else {
                // for (var i: u32 = 0; i < length; i += 1) {
                //     let line = lines[i];
                //     // let d = sdfLineSegmentSquared(pos, line.a, line.b);
                //     // if (d <= .5 * .5) {
                //     //     color += vec4f(line.color.xyz * line.color.a, line.color.a);
                //     // }
                // }
                color = vec4f(fsInput.color.xyz * fsInput.color.a, fsInput.color.a);
            }

            // color.a = 1.0;
            

            // canvas, texture
            return Out(color, color);
        }`
    }
}

