struct Line {
    p1: vec2<f32>,
    p2: vec2<f32>,
    isGlass: f32,
    absorbtion: f32,   
}

struct Ray {
    wavelength: f32,
    intensity: f32,
    position: vec2<f32>,
    direction: vec2<f32>,
    currentIor: f32,
    a: f32,
}

struct Intersection {
    position: vec2<f32>,
    t: f32,
    u: f32,
}

fn Intersect(line: Line, ray: Ray) -> Intersection {
    let u0 = ray.position.x;
    let u1 = ray.direction.x;
    let v0 = ray.position.y;
    let v1 = ray.direction.y;

    let x0 = line.p1.x;
    let x1 = line.p2.x;
    let y0 = line.p1.y;
    let y1 = line.p2.y;

    let t = (((x0 - u0) * (v0 - v1)) - ((y0 - v0) * (u0 - u1))) / 
            (((x0 - x1) * (v0 - v1)) - ((y0 - y1) * (u0 - u1)));

    let u = (((x0 - u0) * (y0 - y1)) - ((y0 - v0) * (x0 - x1))) / 
            (((x0 - x1) * (v0 - v1)) - ((y0 - y1) * (u0 - u1)));
    
    let intersection = line.p1 + t * (line.p2 - line.p1);

    if (t >= 0.0 && t < 1.0 && u > 0.001) {
        return Intersection(intersection, t, u);
    } else {
        return Intersection(vec2(-1.0, -1.0), t, u);
    }
}

fn GoldNoise(xy: vec2f, seed: f32) -> f32 {
    let PHI: f32 = 1.61803398874989484820459;
    return fract(tan(distance(xy * PHI, xy) * seed) * xy.x);
}

fn Normal(line: Line, ray: Ray) -> vec2<f32> {
    let w = line.p2 - line.p1;
    let n0 = normalize(vec2(-w.y, w.x));
    let n1 = normalize(vec2(w.y, -w.x));
    let c = ray.direction - ray.position;
    if (dot(n0, c) <= 0.0) {
        return n0;
    } else {
        return n1;
    }
}

fn WavelengthToIOR(w: f32) -> f32 {
    let wavelength = w / 1000;
    // // BK57 Glass
    // let b1 = 1.03961212;
    // let b2 = 0.231792344;
    // let b3 = 1.01046945;

    // let c1 = 6.00069867 * pow(10.0, -3.0);
    // let c2 = 2.00179144 * pow(10.0, -2.0);
    // let c3 = 1.03560653 * pow(10.0, 2.0);

    // Diamond
    let b1 = 4.3356;
    let b2 = 0.3306;
    let b3 = 0.0;

    let c1 = 0.106 * pow(10.0, 2.0);
    let c2 = 0.0175 * pow(10.0, 2.0);
    let c3 = 1.0 * pow(10.0, 2.0);


    let w2 = pow(wavelength, 2.0);

    let n = sqrt(
        1 + ((b1 * w2) / (w2 - c1)) + ((b2 * w2) / (w2 - c2)) + ((b3 * w2) / (w2 - c3))
    );

    return n;
}

fn mapRange(value: f32, low1: f32, high1: f32, low2: f32, high2: f32) -> f32 {
    return low2 + (high2 - low2) * (value - low1) / (high1 - low1);
}

fn lerp(a: vec2<f32>, b: vec2<f32>, t: f32) -> vec2<f32> {
    return (1 - t) * a + t *  b;
}


@group(0) @binding(0) var<storage, read_write> lines : array<Line>;
@group(0) @binding(1) var<storage, read_write> rays : array<Ray>;
@group(0) @binding(2) var<storage, read_write> newRays : array<Ray>;

@compute @workgroup_size(100, 1)
fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
    let linesLength = arrayLength(&lines) + 1;
    let line = lines[global_id.x];
    var ray = rays[global_id.x];
    var maxDistance = 100000.0;
    var hit: vec2<f32> = vec2(-1.0, -1.0);
    var t: f32;
    var hitIndex: u32;
    var lineHit: Line;
    for (var i: u32 = 0; i < linesLength; i++) {
        let intersection = Intersect(lines[i], ray);
        let intersectionDistance = distance(ray.position, intersection.position);
        if (intersection.position.x != -1.0 && intersection.position.y != -1.0) {
            if (intersectionDistance < maxDistance) {
                maxDistance = intersectionDistance;
                hit = intersection.position;
                lineHit = lines[i];
                hitIndex = i;
                t = intersection.t;
            }
        }
    }

    if (hit.x == -1.0 && hit.y == -1.0) {
        // ray.direction = ray.direction - ray.position;
        // ray.direction *= 1.0;
        // ray.direction += ray.position;
        newRays[global_id.x] = ray;
        return;
    }

    // use angle between vectors to check if should interpolate

    // first find the lines with points at the same position as this
    // or just use sequential after if im lazy - maybe hybrid approach?
    // this might end up being the hardest part here

    var prevLine: Line = lineHit;
    var nextLine: Line = lineHit;
    if (lines[hitIndex-1].p2.x == lineHit.p1.x && lines[hitIndex-1].p2.y == lineHit.p1.y) {
        prevLine = lines[hitIndex-1];
    } else {
        for (var i: u32 = 0; i < linesLength; i++) {
            if (i == hitIndex) {
                continue;
            }
            if (lines[i].p2.x == lineHit.p1.x && lines[i].p2.y == lineHit.p1.y) {
                prevLine = lines[i];
            }
        }
    }
    if (lines[hitIndex+1].p1.x == lineHit.p2.x && lines[hitIndex+1].p1.y == lineHit.p2.y) {
        nextLine = lines[hitIndex+1];
    } else {
        for (var i: u32 = 0; i < linesLength; i++) {
            if (i == hitIndex) {
                continue;
            }
            if (lines[i].p1.x == lineHit.p2.x && lines[i].p1.y == lineHit.p2.y) {
                nextLine = lines[i];
            }
        }
    }

    var prevNormal = Normal(prevLine, ray);
    var currNormal = Normal(lineHit, ray);
    var nextNormal = Normal(nextLine, ray);

    let prevAngle = acos(dot(prevNormal, currNormal) / (length(prevNormal) * length(currNormal)));
    let nextAngle = acos(dot(nextNormal, currNormal) / (length(nextNormal) * length(currNormal)));
    if (prevAngle > 30 * 3.14159265359 / 180) {
        prevNormal = currNormal;
    }
    if (nextAngle > 30 * 3.14159265359 / 180) {
        nextNormal = currNormal;
    }


    var normal: vec2<f32>;
    if (t >= .5) {
        normal = lerp(currNormal, nextNormal, mapRange(t, .5, 1, 0, .5));
    } else {
        normal = lerp(currNormal, prevNormal, mapRange(t, .5, 0, 0, .5));
    }

    normal = normalize(normal);

    // var shouldStillReflect = GoldNoise(hit * 100, 1.1) > .1;
    let shouldStillReflect = true;

    // if is glass
    if (lineHit.isGlass != 0.0 && shouldStillReflect) {
        var n1: f32;
        var n2: f32;
        if (ray.currentIor == 1.0) {
            n1 = ray.currentIor;
            n2 = WavelengthToIOR(ray.wavelength);
        } else {
            n1 = ray.currentIor;
            n2 = 1.0;
        }

        let l = normalize(ray.direction - ray.position);
        let r = n1 / n2;
        let c = dot(-normal, l);

        var v = (r * l) + (
            (r * c) - 
            sqrt(
                abs(
                    1 - 
                    (
                        pow(r, 2.0) * 
                        (
                            1 -
                            pow(c, 2.0)
                        )
                    )
                )
            )
        ) * normal;


        v = normalize(v);
        

        ray.position = hit;
        ray.direction = v + ray.position;
        ray.a = ray.currentIor;
        ray.currentIor = n2;
        ray.intensity *= 1.0 - lineHit.absorbtion;
    } else {
        let reflection = normalize(ray.direction - ray.position) - (2 * dot(normalize(ray.direction - ray.position), normal) * normal);
        ray.position = hit;
        ray.direction = reflection + ray.position;
        if (lineHit.absorbtion >= 0.99) {
            ray.intensity = 0;
        } else {
            ray.intensity *= 1.0 - lineHit.absorbtion;
        }
    }

    newRays[global_id.x] = ray;
}


