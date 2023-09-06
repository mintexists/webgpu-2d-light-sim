import toColor from 'https://esm.sh/color-spectrum@1.1.3';

export let mapRange = (value, low1, high1, low2, high2) => {
    return low2 + (high2 - low2) * (value - low1) / (high1 - low1);
}

export class Line {
    constructor(x1, y1, x2, y2, isGlass, absorbtion) {
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
        this.isGlass = isGlass;
        this.absorbtion = absorbtion;
    }

    static size = 6;

    toArray() {
        return new Float32Array([
            this.x1, this.y1, this.x2, this.y2, this.isGlass ? 1 : 0, this.absorbtion
        ]);
    }

    static fromArray(arr) {
        return new Line(arr[0], arr[1], arr[2], arr[3], arr[4] === 1, arr[5]);
    }

    draw(imageData) {
        let size = Math.sqrt(imageData.length / 4);
        let GetPixel = (x, y) => {
            if (x >= 0 && x < size && y >= 0 && y < size) {
                let index = (y * size + x) * 4;
                return [imageData[index + 0], imageData[index + 1], imageData[index + 2], imageData[index + 3]];
            }
            return [0, 0, 0, 0];
        }        

        let Pixel = (x, y, r, g, b, a) => {
            x = Math.round(x);
            y = Math.round(y);
            if (x >= 0 && x < size && y >= 0 && y < size) {
                if (a < 255) {
                    let [r2, g2, b2, a2] = GetPixel(x, y)
                    r = r2 + ((r / 255) * a)
                    g = g2 + ((g / 255) * a)
                    b = b2 + ((b / 255) * a)
                    a = 255;
                }
                let index = (y * size + x) * 4;
                imageData[index + 0] = r;
                imageData[index + 1] = g;
                imageData[index + 2] = b;
                imageData[index + 3] = a;
            };
        }

        let [r, g, b, a] = [255, 0, 0, 255]
        // steal previous line drawing implimentation 
        // let line = new Line(Math.round(this.p1.x), Math.round(this.p1.y), Math.round(this.p2.x), Math.round(this.p2.y));
        let p1 = {x: Math.round(this.x1), y: Math.round(this.y1)};
        let p2 = {x: Math.round(this.x2), y: Math.round(this.y2)};

        let dx = Math.abs(p2.x - p1.x);
        let sx = p1.x < p2.x ? 1 : -1;
        let dy = -Math.abs(p2.y - p1.y)
        let sy = p1.y < p2.y ? 1 : -1;
        let error = dx + dy;
        let x = p1.x;
        let y = p1.y;

        while (true) {
            Pixel(x, y, r, g, b, a);
            if (x === p2.x && y === p2.y) break;
            let e2 = 2 * error;
            if (e2 >= dy) {
                if (x === p2.x) break;
                error += dy;
                x += sx;
            }
            if (e2 <= dx) {
                if (y === p2.y) break;
                error += dx;
                y += sy;
            }
        }
    }
}

export class Ray {
    constructor(wavelength, intensity, x, y, angle, currentIor = 1) {
        this.wavelength = wavelength;
        this.intensity = intensity;
        this.x1 = x;
        this.y1 = y;
        this.x2 = Math.cos(angle) + x;
        this.y2 = Math.sin(angle) + y;
        this.currentIor = currentIor;
    }

    static size = 8;

    toArray() {
        return new Float32Array([
            this.wavelength, this.intensity, this.x1, this.y1, this.x2, this.y2, this.currentIor, 0,
        ]);
    }

    static fromArray(arr) {
        let ray = new Ray(arr[0], arr[1], arr[2], arr[3], 0, arr[6]);
        ray.x2 = arr[4];
        ray.y2 = arr[5];
        return ray;
    }

    draw(imageData) {
        // debugger
        let size = Math.sqrt(imageData.length / 4);
        let GetPixel = (x, y) => {
            if (x >= 0 && x < size && y >= 0 && y < size) {
                let index = (y * size + x) * 4;
                return [imageData[index + 0], imageData[index + 1], imageData[index + 2], imageData[index + 3]];
            }
            return [0, 0, 0, 0];
        }        

        let Pixel = (x, y, r, g, b, a) => {
            x = Math.round(x);
            y = Math.round(y);
            if (x >= 0 && x < size && y >= 0 && y < size) {
                if (a < 255) {
                    let [r2, g2, b2, a2] = GetPixel(x, y)
                    r = r2 + ((r / 255) * a)
                    g = g2 + ((g / 255) * a)
                    b = b2 + ((b / 255) * a)
                    a = 255;
                }
                let index = (y * size + x) * 4;
                imageData[index + 0] = r;
                imageData[index + 1] = g;
                imageData[index + 2] = b;
                imageData[index + 3] = a;
            };
        }

        let color = toColor(this.wavelength);
        let [r, g, b] = color.slice(4, -1).split(',').map(x => parseInt(x))
        let a = this.intensity * 255;
        // steal previous line drawing implimentation 
        // let line = new Line(Math.round(this.p1.x), Math.round(this.p1.y), Math.round(this.p2.x), Math.round(this.p2.y));
        let p1 = {x: Math.round(this.x1), y: Math.round(this.y1)};
        let p2 = {x: Math.round(this.x2), y: Math.round(this.y2)};

        let dx = Math.abs(p2.x - p1.x);
        let sx = p1.x < p2.x ? 1 : -1;
        let dy = -Math.abs(p2.y - p1.y)
        let sy = p1.y < p2.y ? 1 : -1;
        let error = dx + dy;
        let x = p1.x;
        let y = p1.y;

        let max = 2000;
        let count = 0;
        while (count < max) {
            count++;
            Pixel(x, y, r, g, b, a);
            if (x === p2.x && y === p2.y) break;
            let e2 = 2 * error;
            if (e2 >= dy) {
                if (x === p2.x) break;
                error += dy;
                x += sx;
            }
            if (e2 <= dx) {
                if (y === p2.y) break;
                error += dx;
                y += sy;
            }
        }
    }
}

export let pointLight = (x, y, count, intensity) => {
    let rays = [];
    for (let i = 0; i < count; i++) {
        let angle = Math.random() * 2 * Math.PI;
        // angle = mapRange(i, 0, count, 0, 2 * Math.PI);
        rays.push(new Ray(mapRange(Math.random(), 0, 1, 440, 660), intensity/count, x, y, angle));
        // rays.push(new Ray(520, intensity/count, x, y, angle));

    }
    return rays;
}

export let beam = (x, y, width, count, intensity, angle) => {
    let rays = [];
    for (let i = 0; i < count; i++) {
        let v = mapRange(i, 0, count, -width/2, width/2);
        rays.push(new Ray(mapRange(Math.random(), 0, 1, 440, 660), intensity/count, x + v * Math.cos(angle + Math.PI / 2), y + v * Math.sin(angle + Math.PI / 2), angle));
        // rays.push(new Ray(mapRange(Math.random(), 0, 1, 380, 760), intensity/count, x + v * Math.cos(angle + Math.PI / 2), y + v * Math.sin(angle + Math.PI / 2), angle));
    }
    return rays;
}

export let DrawLine = (imageData, x1, y1, x2, y2, wavelength, intensity) => {
    let [r, g, b] = toColor(wavelength).slice(4, -1).split(',').map(x => parseInt(x))
    let a = intensity * 255;



    // let size = Math.sqrt(imageData.length / 4);
    // let GetPixel = (x, y) => {
    //     if (x >= 0 && x < size && y >= 0 && y < size) {
    //         let index = (y * size + x) * 4;
    //         return [imageData[index + 0], imageData[index + 1], imageData[index + 2], imageData[index + 3]];
    //     }
    //     return [0, 0, 0, 0];
    // }

    // let Pixel = (x, y, r, g, b, a) => {
    //     x = Math.round(x);
    //     y = Math.round(y);
    //     if (x >= 0 && x < size && y >= 0 && y < size) {
    //         if (a < 255) {
    //             let [r2, g2, b2, a2] = GetPixel(x, y)
    //             r = r2 + ((r / 255) * a)
    //             g = g2 + ((g / 255) * a)
    //             b = b2 + ((b / 255) * a)
    //             a = 255;
    //         }
    //         let index = (y * size + x) * 4;
    //         imageData[index + 0] = r;
    //         imageData[index + 1] = g;
    //         imageData[index + 2] = b;
    //         imageData[index + 3] = a;
    //     };
    // }

    // let color = toColor(wavelength);
    // let [r, g, b] = color.slice(4, -1).split(',').map(x => parseInt(x))
    // let a = intensity * 255;

    // let p1 = {x: Math.round(x1), y: Math.round(y1)};
    // let p2 = {x: Math.round(x2), y: Math.round(y2)};

    // let dx = Math.abs(p2.x - p1.x);
    // let sx = p1.x < p2.x ? 1 : -1;
    // let dy = -Math.abs(p2.y - p1.y)
    // let sy = p1.y < p2.y ? 1 : -1;
    // let error = dx + dy;
    // let x = p1.x;
    // let y = p1.y;

    // let max = 20000;
    // let count = 0;
    // while (count < max) {
    //     count++;
    //     Pixel(x, y, r, g, b, a);
    //     if (x === p2.x && y === p2.y) break;
    //     let e2 = 2 * error;
    //     if (e2 >= dy) {
    //         if (x === p2.x) break;
    //         error += dy;
    //         x += sx;
    //     }
    //     if (e2 <= dx) {
    //         if (y === p2.y) break;
    //         error += dx;
    //         y += sy;
    //     }
    // }
}

export let polygon = (x, y, sides, radius, rotation, isGlass, absorbtion) => {
    let points = [];
    for (let i = 0; i < sides; i++) {
        let angle = mapRange(i, 0, sides, 0, 2 * Math.PI) + rotation;
        points.push({x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius});
    }
    let lines = [];
    for (let i = 0; i < points.length; i++) {
        lines.push(new Line(points[i].x, points[i].y, points[(i + 1) % points.length].x, points[(i + 1) % points.length].y, isGlass, absorbtion));
    }
    return lines;
}