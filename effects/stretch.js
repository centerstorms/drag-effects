// Effect 2: stretch the window vertically when dragging up/down quickly.
// Writes to frame.scaleY.

import {DragEffect, alphaFor, timeScale} from '../lib/effect.js';
import {readDouble, readInt} from '../lib/settings.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class StretchEffect extends DragEffect {
    static id = 'stretch';
    static title = 'Vertical stretch';
    static description = 'The window stretches vertically when dragged up or down quickly, giving it an elastic feel.';

    static controls = [
        {
            key: 'stretch-max',
            type: 'int',
            title: 'Maximum stretch',
            subtitle: 'Percent.',
            min: 0, max: 30, step: 1,
        },
        {
            key: 'stretch-strength',
            type: 'double',
            title: 'Sensitivity',
            subtitle: 'Stretch per pixel of movement per frame.',
            min: 0.0005, max: 0.02, step: 0.0005, digits: 4,
        },
        {
            key: 'stretch-smoothing',
            type: 'double',
            title: 'Smoothing',
            min: 0.05, max: 1.0, step: 0.05,
        },
    ];

    start(_ctx) {
        this._value = 0;
    }

    update(ctx, frame) {
        const max = readInt(this.settings, 'stretch-max', 6) / 100;
        const strength = readDouble(this.settings, 'stretch-strength', 0.004);
        const smoothing = readDouble(this.settings, 'stretch-smoothing', 0.2);

        const target = clamp(Math.abs(ctx.dy) * strength, 0, max);
        this._value += (target - this._value) * alphaFor(smoothing, timeScale(ctx.dt));

        frame.scaleY *= 1 + this._value;
    }
}
