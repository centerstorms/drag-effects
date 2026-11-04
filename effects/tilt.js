// Effect 1: rotate the window with horizontal inertia.
// Writes to frame.rotationZ.

import {DragEffect, alphaFor, timeScale} from '../lib/effect.js';
import {readDouble, readInt} from '../lib/settings.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class TiltEffect extends DragEffect {
    static id = 'tilt';
    static title = 'Inertial tilt';
    static description = 'The window rotates around the grab point with horizontal drag and settles back when you stop.';

    static controls = [
        {
            key: 'tilt-max-angle',
            type: 'int',
            title: 'Maximum tilt angle',
            subtitle: 'Degrees.',
            min: 1, max: 30, step: 1,
        },
        {
            key: 'tilt-sensitivity',
            type: 'double',
            title: 'Sensitivity',
            subtitle: 'Degrees per pixel of pointer movement per frame.',
            min: 0.05, max: 3.0, step: 0.05,
        },
        {
            key: 'tilt-smoothing',
            type: 'double',
            title: 'Smoothing',
            subtitle: 'Lower values make the window lag behind the pointer.',
            min: 0.05, max: 1.0, step: 0.05,
        },
    ];

    start(ctx) {
        this._angle = ctx.actor.rotation_angle_z;
    }

    update(ctx, frame) {
        const max = readInt(this.settings, 'tilt-max-angle', 8);
        const sensitivity = readDouble(this.settings, 'tilt-sensitivity', 0.6);
        const smoothing = readDouble(this.settings, 'tilt-smoothing', 0.2);

        const target = clamp(ctx.dx * sensitivity, -max, max);
        this._angle += (target - this._angle) * alphaFor(smoothing, timeScale(ctx.dt));

        frame.rotationZ += this._angle;
    }
}
