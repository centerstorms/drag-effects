// Effect: jelly.
// Writes frame.scaleX / frame.scaleY.
//
// Vertical acceleration kicks a damped spring: the window stretches
// vertically and squeezes horizontally, then oscillates back to normal.
// Unlike stretch (a smooth one-way deformation), jelly overshoots and
// oscillates like a soft body.

import {DragEffect} from '../lib/effect.js';
import {readDouble, readInt} from '../lib/settings.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class JellyEffect extends DragEffect {
    static id = 'jelly';
    static title = 'Jelly';
    static description = 'The window stretches and squeezes with a damped bounce when you change speed.';

    static controls = [
        {
            key: 'jelly-max',
            type: 'int',
            title: 'Maximum deformation',
            subtitle: 'Percent of the window size.',
            min: 0, max: 20, step: 1,
        },
        {
            key: 'jelly-sensitivity',
            type: 'double',
            title: 'Acceleration sensitivity',
            subtitle: 'How strongly speed changes kick the spring.',
            min: 0.0005, max: 0.02, step: 0.0005, digits: 4,
        },
        {
            key: 'jelly-stiffness',
            type: 'double',
            title: 'Stiffness',
            subtitle: 'Higher values return to normal faster.',
            min: 0.05, max: 0.8, step: 0.01, digits: 2,
        },
        {
            key: 'jelly-damping',
            type: 'double',
            title: 'Damping',
            subtitle: 'Closer to 1 means the bounce lasts longer.',
            min: 0.5, max: 0.98, step: 0.01, digits: 2,
        },
    ];

    start(ctx) {
        this._stretch = 0;
        this._velocity = 0;
        this._lastDy = ctx.dy;
    }

    update(ctx, frame) {
        const max = readInt(this.settings, 'jelly-max', 8) / 100;
        const sensitivity = readDouble(this.settings, 'jelly-sensitivity', 0.004);
        const stiffness = readDouble(this.settings, 'jelly-stiffness', 0.35);
        const damping = readDouble(this.settings, 'jelly-damping', 0.82);

        const acceleration = ctx.dy - this._lastDy;
        this._lastDy = ctx.dy;

        this._velocity += acceleration * sensitivity;

        const steps = Math.min(4, Math.max(1, Math.round(ctx.dt / 16.67)));
        const stepK = Math.min(2, Math.max(0.1, (ctx.dt / steps) / 16.67));

        for (let i = 0; i < steps; i++) {
            this._velocity += -this._stretch * stiffness * stepK;
            this._velocity *= Math.pow(damping, stepK);
            this._stretch += this._velocity * stepK;
        }

        this._stretch = clamp(this._stretch, -max, max);

        frame.scaleY *= 1 + this._stretch;
        frame.scaleX *= 1 - this._stretch * 0.6;
    }
}
