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

fn Intersect(line: Line, ray: Ray) -> vec2<f32> {
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

    if (t >= 0.0 && t <= 1.0 && u > 0.001) {
        return intersection;
    } else {
        return vec2(-1.0, -1.0);
    }
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
    let b1 = 1.03961212;
    let b2 = 0.231792344;
    let b3 = 1.01046945;

    let c1 = 6.00069867 * pow(10.0, -3.0);
    let c2 = 2.00179144 * pow(10.0, -2.0);
    let c3 = 1.03560653 * pow(10.0, 2.0);

    let w2 = pow(wavelength, 2.0);

    let n = sqrt(
        1 + ((b1 * w2) / (w2 - c1)) + ((b2 * w2) / (w2 - c2)) + ((b3 * w2) / (w2 - c3))
    );

    return n;
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
    var lineHit: Line;
    for (var i: u32 = 0; i < linesLength; i++) {
        let intersection = Intersect(lines[i], ray);
        let intersectionDistance = distance(ray.position, intersection);
        if (intersection.x != -1.0 && intersection.y != -1.0) {
        // if (intersection.x != -1.0 && intersection.y != -1.0 && floor(intersection.x) != floor(ray.position.x) && floor(intersection.y) != floor(ray.position.y)) {
            // if (lines[i].isGlass != 0) { // if is glass
            //     if (floor(intersection.x) == floor(ray.position.x) && floor(intersection.y) == floor(ray.position.y)) {
            //         continue;
            //     }
            // }
            if (intersectionDistance < maxDistance) {
                maxDistance = intersectionDistance;
                hit = intersection;
                lineHit = lines[i];
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

    // if (floor(hit.x) == floor(ray.position.x) && floor(hit.y) == floor(ray.position.y)) {
    //     ray.wavelength = 440.0;
    // }

    // ok do the new stuff here

    let normal = Normal(lineHit, ray);
    if (lineHit.isGlass != 0.0) {
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
        let c = dot(normal, l);

        var v = (r * l) + ((r * c - sqrt(abs((1 - pow(r, 2.0)) * (1 - pow(c, 2.0))))) * normal);

        // v = normalize(v);
        

        ray.position = hit;
        ray.direction = v + ray.position;
        ray.currentIor = n2;
        ray.intensity *= 1.0 - line.absorbtion;
        // if is glass do the shit

    } else {
        // otherwise dont do the shit
        // wait do i need to have rays store if they are in glass the whole time
        // because that would be annoying
        // ohno i think i might
        // thats annoying ill do that later

        let reflection = normalize(ray.direction - ray.position) - (2 * dot(normalize(ray.direction - ray.position), normal) * normal);
        ray.position = hit;
        ray.direction = reflection + ray.position;
        if (line.absorbtion >= 0.99) {
            ray.intensity = 0;
        } else {
            ray.intensity *= 1.0 - line.absorbtion;
        }
    }

    // ray.direction = hit;

    // ray.direction = ray.direction - ray.position;
    // ray.direction *= 100.0;
    // ray.direction += ray.position;
    newRays[global_id.x] = ray;
}


