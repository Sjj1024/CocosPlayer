import { error, game, Director } from "cc";

const getOrCreateTimeScalePolyfill = (() => {
    let polyfill: undefined | { multiplier: number; };

    return () => {
        if (!polyfill) {
            const polyfill_ = { multiplier: 1.0 };
            const tick = Director.prototype.tick;
            Director.prototype.tick = function(dt: number, ...args) {
                tick.call(this, dt * polyfill_.multiplier, ...args);
            };
            polyfill = polyfill_;
        }
        return polyfill;
    };
})();

export function setTimeScale(multiplier: number) {
    getOrCreateTimeScalePolyfill().multiplier = multiplier;
}

if (!('__debugTickSlow' in globalThis)) {
    Object.defineProperty(globalThis, '__debugTickSlow', {
        value(deltaTime: number) {
            if (!game.isPaused()) {
                error(`You should pause to use __debugTickN()`);
                return;
            }
            const multiplier = getOrCreateTimeScalePolyfill().multiplier;
            const tickLength = (1.0 / 60.0 * multiplier);
            let ticks = deltaTime / tickLength;
            let nTicks = Math.trunc(ticks);
            let frac = ticks - nTicks;
            const stepFrac = () => setTimeout(() => game.step(), frac * 1000);
            if (nTicks === 0) {
                stepFrac();
            } else {
                const handle = setInterval(() => {
                    game.step();
                    --nTicks;
                    if (nTicks === 0) {
                        clearInterval(handle);
                        stepFrac();
                    }
                }, tickLength * 1000);
            }
        },
    });    
}
