// Effect 3: "lift" the window slightly when a drag starts.
// Writes to frame.scaleX and frame.scaleY.

import {DragEffect, alphaFor, timeScale} from '../lib/effect.js';
import {readDouble} from '../lib/settings.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class LiftEffect extends DragEffect {
    static id = 'lift';
    static title = 'Lift';
    static description = 'The window grows slightly while dragging, as if lifted off the surface.';

    static controls = [
        {
            key: 'lift-scale',
            type: 'double',
            title: 'Scale',
            subtitle: '1.03 = 3% larger.',
            min: 1.0, max: 1.3, step: 0.01,
        },
        {
            key: 'lift-smoothing',
            type: 'double',
            title: 'Smoothing',
            min: 0.05, max: 1.0, step: 0.05,
        },
    ];

    start(ctx) {
        this._scale = clamp(ctx.actor.scale_x, 1, 1.3);
    }

    update(ctx, frame) {
        const target = readDouble(this.settings, 'lift-scale', 1.03);
        const smoothing = readDouble(this.settings, 'lift-smoothing', 0.25);

        this._scale += (target - this._scale) * alphaFor(smoothing, timeScale(ctx.dt));

        frame.scaleX *= this._scale;
        frame.scaleY *= this._scale;
    }
}
