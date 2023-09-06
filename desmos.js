let element = document.getElementById('calculator')
console.log(Desmos)
let calc = Desmos.Private.GeometryBeta(element, {
    pasteGraphLink: true,
    showResetButtonOnGraphpaper: true,
})

let embed = document.getElementById('embed')
console.log(embed)

let defaultState = await fetch('./defaultState.json').then(r => r.text())
calc.setDefaultState(defaultState)

let state = JSON.parse(window.localStorage.getItem('state') || defaultState)// || defaultState;
if (state) {
    calc.setState(state)
}

let svg;
let el = document.createElement("null");
document.body.appendChild(el)

let onChangeEvent = (n, e) => {
    console.log(n, e)
    window.localStorage.setItem('state', JSON.stringify(calc.getState()))
    // calc.setMathBounds({
    //     top: 10,
    //     bottom: -10,
    //     left: -10,
    //     right: 10,
    // })
    // console.log(calc.getState(), calc.expressionAnalysis)
    let configOptions = {
        LineResolution: 1,
        LightIntensity: 100, 
        RayCount: 100000,
        BeamWidth: 100,
        Absorbtion: .1,
        GlassAbsorbtion: 0,
    }
    let expressions = calc.getExpressions()
    expressions.map(expression => {
        return expression?.latex?.match(new RegExp(`V_{(${Object.keys(configOptions).join('|')})}=(.+)`))
    }).filter(a => a).forEach(expression => {
        console.log(expression)
        let key = expression[1]
        let value = expression[2]
        if (!isNaN(parseFloat(value))) {
            configOptions[key] = parseFloat(value)
        }
    })

    localStorage.setItem('configOptions', JSON.stringify(configOptions))

    calc.asyncScreenshot({
        format: 'svg',
        width: 1000,
        height: 1000,
        // height: calc.graphpaperBounds.mathCoordinates.width,
        mathBounds: {
            top: 10,
            bottom: -10,
            left: -10,
            right: 10,
        },
        mode: 'contain'
    }, s => {
        // svg = s;
        // console.log(s)
        localStorage.setItem('svg', s)
        embed.src = embed.src
        // el.innerHTML = s;
        // console.log(e)
        // console.log(element)
    })
}

calc.observeEvent('change', onChangeEvent)

onChangeEvent()