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
        if (d < .5) {
            color += vec4f(line.color.xyz * line.color.a, line.color.a);
        }
    }

    return Out(color, color);
}
