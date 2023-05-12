/** @type {HTMLCanvasElement} */
let canvas = document.getElementById("canvas");
let size = 1000;
canvas.width = size;
canvas.height = size;

const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
if (!device) {
    console.log('need a browser that supports WebGPU');
}

let context = canvas.getContext('webgpu');

const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
context.configure({
    device,
    format: presentationFormat,
    alphaMode: "premultiplied",
});

let shader = await fetch("shader.wgsl").then(r => r.text());

const module = device.createShaderModule({
    code: shader,
});

const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
        module,
        entryPoint: 'vs',
    },
    fragment: {
        module,
        entryPoint: 'fs',
        targets: [{ format: presentationFormat }],
    }
});

let texturelikeBuffer = device.createBuffer({
    mappedAtCreation: false,
    size: size * size * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
});

let lineCount = 100000;
let lines = new Float32Array(lineCount * 8)
let linesBuffer = device.createBuffer({
    mappedAtCreation: false,
    size: lines.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
});
device.queue.writeBuffer(linesBuffer, 0, lines);


const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
        // { binding: 0, resource: sampler },
        // { binding: 1, resource: texture.createView() },
        { binding: 0, resource: { buffer: texturelikeBuffer } },
        { binding: 1, resource: { buffer: linesBuffer } },
    ],
});

const renderPassDescriptor = {
    label: 'our basic canvas renderPass',
    colorAttachments: [
        {
            // view: <- to be filled out when we render
            clearValue: [0, 0, 0, 1],
            loadOp: 'clear',
            storeOp: 'store',
        },
    ],
};

let render = async () => {
    for (let i = 0; i < lineCount; i++) {
        let line = [
            Math.random() * size,
            Math.random() * size,
            Math.random() * size,
            Math.random() * size,
            Math.random(),
            Math.random(),
            Math.random(),
            Math.random() * .01,
        ]
        lines.set(line, i * 8);
    }
    device.queue.writeBuffer(linesBuffer, 0, lines);

    renderPassDescriptor.colorAttachments[0].view = context.getCurrentTexture().createView();
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3);
    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);

    // lines.fill(0);
    // device.queue.writeBuffer(linesBuffer, 0, lines);
}

// await render();

let batch = 1;
let loop = async () => {
    for (let i = 0; i < batch; i++) {
        await render();
    }
    console.log('a')
    requestAnimationFrame(loop);
}

document.addEventListener("keydown", async e => {
    if (e.key == " ") {
        console.log('a')
        for (let i = 0; i < batch; i++) {
            await render();
        }    
    }
    if (e.key == "Enter") {
        requestAnimationFrame(loop);
    }
})

// requestAnimationFrame(loop);