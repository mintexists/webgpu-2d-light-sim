import {Ray, Line, pointLight, DrawLine, polygon, beam} from './helpers.js';
import { LoadSVG } from './svg/main.js';
import toColor from 'https://esm.sh/color-spectrum?bundle';
import { LineDraw } from './linedraw-optimized.js';
/** @type {HTMLCanvasElement} */
let canvas = document.getElementById("canvas");
let size = 4000;
canvas.width = size;
canvas.height = size;
let linedraw = new LineDraw(canvas, 10000);
await linedraw.init();

let deg = (deg) => deg * Math.PI / 180;

const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
if (!device) {
    console.log('need a browser that supports WebGPU');
}

let shader = await fetch("shader.wgsl").then(r => r.text());

let lines = [
    new Line(0, 0, 0, size, false,       .1),
    new Line(0, 0, size, 0, false,       .1),
    new Line(size, 0, size, size, false, .1),
    new Line(0, size, size, size, false, .1),
    // ...polygon(500, 500, 1000, 500, Math.PI/6, false, .1),
    // ...polygon(500, 500, 3, 100, Math.PI/6, true, .1),
    // ...polygon(700, 500, 3000, 100, Math.PI/6, true, .1),
    // new Line(100, 100, 100, 900, false, .1),
    // new Line(100, 100, 900, 100, false, .1),
    // new Line(900, 100, 900, 900, false, .1),
    // new Line(100, 900, 900, 900, false, .1),

    ...polygon(100, 550, 3, 100, deg(30), true, .1),
    // new Line(0, 700, 1000, 700, false, .1),
    // new Line(0, 300, 800, 300, false, .1),
    new Line(200, 600, 400, 500, false, .1),

    ...polygon(1000, 1000, 1000, 1000, deg(180), false, .1).slice(1000/2),

    // ...polygon(300, 500, 100, 100, deg(90), true, .1).slice(100/2),
    // new Line(300, 400, 300, 600, true, .1),
    // ...polygon(300, 500, 1000, 100, 0, true, .1),

    // new Line(500, 1000, 1000, 0, false, .1),

    // ...(() => {
    //     let lines = [];
    //     let step = .1;
    //     for (let x = 0; x < 1000; x+= step) {
    //         let fn = (x) => 0.005 * (x - 500) ** 2 + 100;
    //         if (x > 400 && x < 600) {
    //             lines.push(new Line(x, fn(x), x+step, fn(x+step), false, .1));
    //         }
    //     }
    //     return lines;
    // })(),
]

let rays = [
    // ...pointLight(200, 500, 100000, 100)
    ...beam(10, 600, 0, 1000, 10, deg(-45))
    // ...beam(10, 500, 200, 10000, 100, deg(0))
    
];

// LOAD THE SVG HERE
// let inputs = await LoadSVG(await fetch('./svg/input.svg').then(r=>r.text()))
let inputs = await LoadSVG(localStorage.getItem('svg'))
rays = inputs.rays;
lines = inputs.lines;

let linesFloat32 = new Float32Array(lines.length * Line.size);
for (let i = 0; i < lines.length; i++) {
    linesFloat32.set(lines[i].toArray(), i * Line.size);
}

let raysFloat32 = new Float32Array(rays.length * Ray.size);
for (let i = 0; i < rays.length; i++) {
    raysFloat32.set(rays[i].toArray(), i * Ray.size);
}

// console.log(linesFloat32, raysFloat32)

console.log(raysFloat32, rays)

let gpuBufferLines = device.createBuffer({
    mappedAtCreation: false,
    size: linesFloat32.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
});

device.queue.writeBuffer(gpuBufferLines, 0, linesFloat32);

let gpuBufferRays = device.createBuffer({
    mappedAtCreation: false,
    size: raysFloat32.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
});

device.queue.writeBuffer(gpuBufferRays, 0, raysFloat32);

let gpuOutputBuffer = device.createBuffer({
    size: raysFloat32.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
});

let computeShader = device.createShaderModule({
    code: shader
});

let computePipeline = device.createComputePipeline({
    layout: "auto",
    compute: {
        module: computeShader,
        entryPoint: "main"
    }
});

const bindGroup = device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0 /* index */),
    entries: [
        {
            binding: 0,
            resource: {
                buffer: gpuBufferLines
            }
        },
        {
            binding: 1,
            resource: {
                buffer: gpuBufferRays
            }
        },
        {
            binding: 2,
            resource: {
                buffer: gpuOutputBuffer
            }
        }
    ]
});

// lines = [
//     ...polygon(500, 500, 3, 300, 0, false, 0),
//     ...polygon(600, 500, 3, 300, 0, false, 0),
//     // ...polygon(500, 500, 3, 300, 0, false, 0),
// ]

lines.forEach(line => linedraw.addToQueue([
    line.x1, line.y1,
    line.x2, line.y2,
    1.0, 0.0, 0.0, 1.0
]));
await linedraw.draw();
// debugger;

let previousRays = [...rays];

let compute = async () => {
    let commandEncoder = device.createCommandEncoder();

    let passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(computePipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.max(1, Math.min(Math.ceil(rays.length / 100), 65562)));
    passEncoder.end();

    const gpuReadBuffer = device.createBuffer({
        size: raysFloat32.byteLength,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });

    // Encode commands for copying buffer to buffer.
    commandEncoder.copyBufferToBuffer(gpuOutputBuffer, 0, gpuReadBuffer, 0, gpuReadBuffer.size);

    const commandBuffer = commandEncoder.finish();
    device.queue.submit([commandBuffer]);

    await device.queue.onSubmittedWorkDone();

    await gpuReadBuffer.mapAsync(GPUMapMode.READ);
    let resultBuffer = new Float32Array(gpuReadBuffer.getMappedRange().slice(0));

    let time = performance.now();
    for (let i = 0; i < resultBuffer.length; i+=Ray.size) {
        let ray = Ray.fromArray(resultBuffer.slice(i, i+Ray.size))
        let prevRay = previousRays[i/Ray.size];

        let [r, g, b] = toColor(ray.wavelength).slice(4, -1).split(',').map(x => parseInt(x)).map(x => x/255)
        let a = prevRay.intensity;

        linedraw.addToQueue([
            prevRay.x1, prevRay.y1, ray.x1, ray.y1, r, g, b, a
        ])

        previousRays[i/Ray.size] = ray;
    }


    console.log(performance.now()-time)

    console.log(resultBuffer)

    // putImageData();

    gpuReadBuffer.unmap();

    // raysFloat32 = resultBuffer;

    device.queue.writeBuffer(gpuBufferRays, 0, resultBuffer);

    await linedraw.draw();
}

// let time = performance.now();
// await compute();
// await compute();
// console.log(performance.now()-time)
// ctx.fillRect(0, 0, size, size);
// time = performance.now();
// await compute();
// console.log(performance.now()-time)
// time = performance.now();
// await compute();
// console.log(performance.now()-time)

let t = performance.now();
let max = 500;
let i = 0;

let paused=false;

let loop = async () => {
    console.log(i)
    if (i++ > max) {
        console.log("done in ", performance.now() - t)
        return;
    };
    let time = performance.now();
    await compute();
    console.log(performance.now()-time)
    if (!paused) requestAnimationFrame(loop);
}

if (!paused) requestAnimationFrame(loop);

document.addEventListener("keydown", async e => {
    if (e.key == " ") {
        // e.preventDefault();
        // let time = performance.now();
        // await compute();
        // console.log(performance.now()-time)
        paused=!paused
        if (!paused) requestAnimationFrame(loop);
        // console.log('a')
    }
})

// i think next is bind group n stuff
// should check how the webgpufundamentals examples do the per frame stuff