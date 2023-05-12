import { ComputeContext, ComputeShader, StorageBuffer } from 'https://esm.sh/@wgpu-compute/core@0.0.1'
// import 'https://cdn.jsdelivr.net/gh/greggman/webgpu-helpers/show-request-and-adapter-info.js';

const shader = /* wgsl */`
struct Matrix {
    size : vec2<f32>,
    numbers: array<f32>,
};

@group(0) @binding(0) var<storage, read_write> firstMatrix : Matrix;
@group(0) @binding(1) var<storage, read_write> secondMatrix : Matrix;
@group(0) @binding(2) var<storage, read_write> resultMatrix : Matrix;

@compute @workgroup_size(1, 1)
fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
    resultMatrix.size = vec2<f32>(firstMatrix.size.x, secondMatrix.size.y);

    let resultCell = vec2<u32>(global_id.x, global_id.y);
    var result = 0.0;
    for (var i = 0u; i < u32(firstMatrix.size.y); i = i + 1u) {
        let a = i + resultCell.x * u32(firstMatrix.size.y);
        let b = resultCell.y + i * u32(secondMatrix.size.y);
        result = result + firstMatrix.numbers[a] * secondMatrix.numbers[b];
    }
    
    let index = resultCell.y + resultCell.x * u32(secondMatrix.size.y);
    resultMatrix.numbers[index] = result;
}`

const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
if (!device) {
    console.log('need a browser that supports WebGPU');
}

// First Matrix
const firstMatrix = new Float32Array([
    2 /* rows */, 4 /* columns */,
    1, 2, 3, 4,
    5, 6, 7, 8
]);

const gpuBufferFirstMatrix = device.createBuffer({
    mappedAtCreation: false,
    size: firstMatrix.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
});
device.queue.writeBuffer(gpuBufferFirstMatrix, 0, firstMatrix);
// const arrayBufferFirstMatrix = gpuBufferFirstMatrix.getMappedRange();
// new Float32Array(arrayBufferFirstMatrix).set(firstMatrix);
gpuBufferFirstMatrix.unmap();


// Second Matrix
const secondMatrix = new Float32Array([
    4 /* rows */, 2 /* columns */,
    1, 2,
    3, 4,
    5, 6,
    7, 8
]);

const gpuBufferSecondMatrix = device.createBuffer({
    mappedAtCreation: true,
    size: secondMatrix.byteLength,
    usage: GPUBufferUsage.STORAGE
});
const arrayBufferSecondMatrix = gpuBufferSecondMatrix.getMappedRange();
new Float32Array(arrayBufferSecondMatrix).set(secondMatrix);
gpuBufferSecondMatrix.unmap();


// Result Matrix
const resultMatrixBufferSize = Float32Array.BYTES_PER_ELEMENT * (2 + firstMatrix[0] * secondMatrix[1]);
const resultMatrixBuffer = device.createBuffer({
    size: resultMatrixBufferSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
});


// Compute shader code
const shaderModule = device.createShaderModule({ code: shader });

// Pipeline setup
const computePipeline = device.createComputePipeline({
    layout: "auto",
    compute: {
        module: shaderModule,
        entryPoint: "main"
    }
});


// Bind group
const bindGroup = device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0 /* index */),
    entries: [
        {
            binding: 0,
            resource: {
                buffer: gpuBufferFirstMatrix
            }
        },
        {
            binding: 1,
            resource: {
                buffer: gpuBufferSecondMatrix
            }
        },
        {
            binding: 2,
            resource: {
                buffer: resultMatrixBuffer
            }
        }
    ]
});

let run = async () => {
    // Commands submission
    const commandEncoder = device.createCommandEncoder();

    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(computePipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(firstMatrix[0], secondMatrix[1]);
    passEncoder.end();

    // Get a GPU buffer for reading in an unmapped state.
    const gpuReadBuffer = device.createBuffer({
        size: resultMatrixBufferSize,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });

    // Encode commands for copying buffer to buffer.
    commandEncoder.copyBufferToBuffer(
        resultMatrixBuffer /* source buffer */,
        0 /* source offset */,
        gpuReadBuffer /* destination buffer */,
        0 /* destination offset */,
        resultMatrixBufferSize /* size */
    );

    // Submit GPU commands.
    const gpuCommands = commandEncoder.finish();
    device.queue.submit([gpuCommands]);


    // Read buffer.
    await gpuReadBuffer.mapAsync(GPUMapMode.READ);
    const arrayBuffer = gpuReadBuffer.getMappedRange();
    const res = new Float32Array(arrayBuffer);

    console.log(res)
}

await run();
let newMatrix = new Float32Array([
    2 /* rows */, 4 /* columns */,
    0, 0, 0, 0,
    0, 0, 0, 0
]);
device.queue.writeBuffer(gpuBufferFirstMatrix, 0, newMatrix);
await run();