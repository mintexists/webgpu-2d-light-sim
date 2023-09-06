import { pointLight, mapRange, Line, beam } from '../helpers.js'

let approxEq = (a, b, epsilon=0.01) => {
    return Math.abs(a - b) < epsilon
}

export async function LoadSVG(svgRaw) {
    // console.log(svgRaw)
    let element = document.createElement("null")
    element.innerHTML = svgRaw;
    // console.log(element)
    document.body.appendChild(element)
    
    
    let COLORS = {
        PURPLE: "#6042a6",
        RED: "#c74440",
        BLACK: "#000000",
        BLUE: "#2d70b3",
        ORANGE: "#fa7e19",
    }
    
    let HIDE_PURPLE_POINTS = true;
    
    let Dimensions = {
        width:  1000,
        height: 1000,
    };

    let configOptions = {
        LineResolution: 1,
        LightIntensity: 100, 
        RayCount: 100000,
        BeamWidth: 100,
        Absorbtion: .1,
        GlassAbsorbtion: 0,
    }

    if (JSON.parse(localStorage.getItem('configOptions'))) {
        configOptions = JSON.parse(localStorage.getItem('configOptions'))
    }
    
    let CurveResolution = configOptions.LineResolution;
    
    let Intensity = configOptions.LightIntensity;
    let RayCount = configOptions.RayCount;

    let BeamWidth = configOptions.BeamWidth;
    
    let Absorbtion = configOptions.Absorbtion;

    let GlassAbsorbtion = configOptions.GlassAbsorbtion
    
    let output = {
        lines: [],
        rays: [],
    }
    
    let svg = element.children[0];
    let svgDimensions = {
        width: svg.getAttribute('width'),
        height: svg.getAttribute('height'),
    }
    let expressions = [...[...svg.children[1].children].find(s => s.id.startsWith('expressions-')).children]
    // this is bad! it removes all the ones that arent in the left bar menu!
    // expressions.forEach(x => {
    //     if (x.children[0].innerHTML.startsWith("Secret")) {
    //         // x.remove();
    //         // console.log([x.children[1].setAttribute('stroke-opacity', 0)])
    //     }
    // })
    // expressions = expressions.filter(x => !x.children[0].innerHTML.startsWith("Secret"))
    console.log(expressions)
    let paths = [];
    let recurse = (element) => {
        [...element.children].forEach(e => {
            if (e.tagName == "path") {
                paths.push(e)
            } else {
                recurse(e)
            }
        })
    }
    recurse([...svg.children[1].children].find(s => s.id.startsWith('expressions-')))
    paths = paths.filter(p => p.getTotalLength() > 0)
    // console.log(paths)
    
    // Do the Light Points
    let points = paths.filter(e => e.className.baseVal == 'dcg-svg-point')
    if (HIDE_PURPLE_POINTS) {
        points.forEach(e => e.getAttribute("stroke") == COLORS.PURPLE ? e.remove() : {})
    }
    points = points.filter(e => e.getAttribute("stroke") != COLORS.PURPLE)
    // console.log(points)
    points.filter(e => e.getAttribute("stroke") == COLORS.ORANGE).forEach(e => {
        let bbox = e.getBBox()
        let x = mapRange(bbox.x + bbox.width / 2, 0, svgDimensions.width, 0, Dimensions.width)
        let y = mapRange(bbox.y + bbox.height / 2, 0, svgDimensions.height, 0, Dimensions.height)
        output.rays.push(...pointLight(x, y, RayCount, Intensity))
    })
    
    // Do the Lines
    let lines = paths.filter(e => e.className.baseVal == 'dcg-svg-curve')
    let mirrors = lines.filter(e => e.getAttribute("stroke") == COLORS.BLACK)
    let glass = lines.filter(e => e.getAttribute("stroke") == COLORS.BLUE)
    let beams = lines.filter(e => e.getAttribute("stroke") == COLORS.ORANGE)
    let lasers = lines.filter(e => e.getAttribute("stroke") == COLORS.RED)
    // console.log(lines, mirrors, glass)
    
    mirrors.forEach(e => {
        let length = e.getTotalLength()
        let points = [];
        // for (let i = 0; i <= length; i += length / CurveResolution) {
        let j = 0;
        for (let i = 0; i <= length + CurveResolution / 2; i += CurveResolution) {
            let point = e.getPointAtLength(i)
            if (j > 2 && i < length - CurveResolution) {
                let slope = Math.atan2(point.y - points[j-1].y, point.x - points[j-1].x)
                let lastSlope = Math.atan2(points[j-1].y - points[j-2].y, points[j-1].x - points[j-2].x)
                if (approxEq(slope, lastSlope, 0.000001)) {
                    // continue
                }
            }
            j++;
            points.push(point)
        }
    
        for (let i = 0; i < points.length - 1; i += 1) {
            output.lines.push(new Line(
                mapRange(points[i].x, 0, svgDimensions.width, 0, Dimensions.width),
                mapRange(points[i].y, 0, svgDimensions.height, 0, Dimensions.height),
                mapRange(points[i+1].x, 0, svgDimensions.width, 0, Dimensions.width),
                mapRange(points[i+1].y, 0, svgDimensions.height, 0, Dimensions.height),
                false,
                Absorbtion,
            ))
        }
    })
    
    glass.forEach(e => {
        let length = e.getTotalLength()
        let points = [];
        // for (let i = 0; i <= length; i += length / CurveResolution) {
        let j = 0;
        for (let i = 0; i <= length + CurveResolution / 2; i += CurveResolution) {
            let point = e.getPointAtLength(i)
            if (j > 2 && i < length - CurveResolution) {
                let slope = Math.atan2(point.y - points[j-1].y, point.x - points[j-1].x)
                let lastSlope = Math.atan2(points[j-1].y - points[j-2].y, points[j-1].x - points[j-2].x)
                if (approxEq(slope, lastSlope, 0.000001)) {
                    // continue
                }
            }
            j++;
            points.push(point)
        }
    
        for (let i = 0; i < points.length - 1; i += 1) {
            output.lines.push(new Line(
                mapRange(points[i].x, 0, svgDimensions.width, 0, Dimensions.width),
                mapRange(points[i].y, 0, svgDimensions.height, 0, Dimensions.height),
                mapRange(points[i+1].x, 0, svgDimensions.width, 0, Dimensions.width),
                mapRange(points[i+1].y, 0, svgDimensions.height, 0, Dimensions.height),
                true,
                GlassAbsorbtion,
            ))
        }
    })

    beams.forEach(e => {
        let length = e.getTotalLength();
        let start = e.getPointAtLength(0);
        let end = e.getPointAtLength(length);
        let angle = Math.atan2(end.y - start.y, end.x - start.x);
    //     output.rays.push(...beam(
    //         mapRange(start.x, 0, svgDimensions.width, 0, Dimensions.width),
    //         mapRange(start.y, 0, svgDimensions.height, 0, Dimensions.height),
    //         BeamWidth,
    //         RayCount,
    //         Intensity,
    //         angle
    //     ))
        beam(
            mapRange(start.x, 0, svgDimensions.width, 0, Dimensions.width),
            mapRange(start.y, 0, svgDimensions.height, 0, Dimensions.height),
            BeamWidth,
            RayCount,
            Intensity,
            angle
        ).forEach(beam => {
            output.rays.push(beam)
        })
    })

    lasers.forEach(e => {
        let length = e.getTotalLength();
        let start = e.getPointAtLength(0);
        let end = e.getPointAtLength(length);
        let angle = Math.atan2(end.y - start.y, end.x - start.x);
        console.log(angle)
        output.rays.push(...beam(
            mapRange(start.x, 0, svgDimensions.width, 0, Dimensions.width),
            mapRange(start.y, 0, svgDimensions.height, 0, Dimensions.height),
            0,
            RayCount,
            Intensity,
            angle
        ))
    })


    element.remove()
    return output;
}

// console.log(await LoadSVG('./input.svg'))