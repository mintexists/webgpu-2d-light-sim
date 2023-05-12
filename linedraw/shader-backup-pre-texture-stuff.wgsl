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

fn getIndex(uv: vec2f, size: u32) -> u32 {
    let x = u32(uv.x * f32(size));
    let y = u32(uv.y * f32(size));
    return u32(x + y * (size));
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

// @group(0) @binding(0) var ourSampler: sampler;
// @group(0) @binding(1) var ourTexture: texture_2d<f32>;
@group(0) @binding(0) var<storage, read_write> pixels : array<vec4f>;
@group(0) @binding(1) var<storage, read_write> lines: array<Line>;

@fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
    let size = u32(sqrt(f32(arrayLength(&pixels))));
    var uv = fsInput.texcoord;
    let pos = fsInput.position.xy;
    // let p1 = pixels[0].xy;
    // let p2 = vec2f(900, 700);

    // pixels[0] += vec4f(0.1, 0.0, 0.0, 0.0);

    // let d = sdfLineSegment(pos, p1, p2);
    // if (d < .5) {
    //     let a = .001;
    //     pixels[getIndex(uv, size)] += vec4f(1.0 * a, 0.0, 0.0, a);
    // } else {
    //     pixels[getIndex(uv, size)] += vec4f(0.0, 0.0, 0.0, 0.0);
    // }

    let length: u32 = arrayLength(&lines);
    for (var i: u32 = 0; i < length; i += 1) {
        let line = lines[i];
        let d = sdfLineSegment(pos, line.a, line.b);
        if (d < .5) {
            pixels[getIndex(uv, size)] += vec4f(line.color.xyz * line.color.a, line.color.a);
        }
    }

    // pixels[getIndex(uv, size)] = d < 0.1 ? vec4(1.0, 0, 0, 1.0) : vec4(0.0, 0, 0, 1.0);
    // if (pixels[getIndex(uv, size)].x < 1.0) {
    //     pixels[getIndex(uv, size)] = vec4(1.0, 0, 0, 1.0);
    // } else {
    //     pixels[getIndex(uv, size)] = vec4(0.0, 0, 0, 1.0);
    // }

    // multiply alpha becausse it wants premul
    return pixels[getIndex(uv, size)];
    // pixels[getIndex(uv, size)] -= vec4(0.0, 0.0, 0.0, 0.01);
    // return pixels[getIndex(uv, size)];

    // return vec4(pixels[getIndex(newUV, size)]);
}
