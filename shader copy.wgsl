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

    if (t >= 0.0 && t <= 1.0 && u >= 0.0) {
        return intersection;
    } else {
        return vec2(-1.0, -1.0);
    }
}

@group(0) @binding(0) var<storage, read_write> lines : array<Line>;
@group(0) @binding(1) var<storage, read_write> rays : array<Ray>;
@group(0) @binding(2) var<storage, read_write> newRays : array<Ray>;

@compute @workgroup_size(1, 1)
fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
    let linesLength = arrayLength(&lines) + 1;
    let line = lines[global_id.x];
    var ray = rays[global_id.x];
    // ray.wavelength = f32(linesLength);
    var maxDistance = 1000.0;
    var hit: vec2<f32>;// = vec2(-1.0, -1.0);
    var lineHit: Line;
    for (var i: u32 = 0; i < linesLength; i++) {
        let intersection = Intersect(line, ray);
        let intersectionDistance = distance(ray.position, intersection);
        // hit = intersection;
        //if (intersection.x != -1.0 && intersection.y != -1.0) {// && floor(intersection.x) != floor(ray.position.x) && floor(intersection.y) != floor(ray.position.y)) {
            // ray.position = intersection;
            // if (intersectionDistance <= maxDistance) {
            //     maxDistance = intersectionDistance;
            //     hit = intersection;
            //     lineHit = lines[i];
            // }
        //}
    }

    // if (hit.x == -1.0 && hit.y == -1.0) {
    //     ray.direction = ray.direction - ray.position;
    //     ray.direction *= 10.0;
    //     ray.direction += ray.position;
    //     newRays[global_id.x] = ray;
    //     return;
    // }

    ray.direction = hit;

    // ray.direction = ray.direction - ray.position;
    // ray.direction *= 100.0;
    // ray.direction += ray.position;
    newRays[global_id.x] = ray;
}


