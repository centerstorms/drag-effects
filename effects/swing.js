// Effect: swing.
// Writes frame.rotationZ.
//
// The window behaves like it is hanging from the grab point: moving the
// pointer sideways makes it lean in the opposite direction. Unlike tilt
// (velocity-based), the angle is based on total horizontal displacement.

import {DragEffect, alphaFor, timeScale} from '../lib/effect.js';
import {readDouble, readInt} from '../lib/settings.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class SwingEffect extends DragEffect {
    static id = 'swing';
    static title = 'Swing';
    static description = 'The window leans like a pendulum based on how far you have dragged sideways.';

    static controls = [
        {
            key: 'swing-max-angle',
            type: 'int',
            title: 'Maximum angle',
            subtitle: 'Degrees.',
            min: 1, max: 45, step: 1,
        },
        {
            key: 'swing-sensitivity',
            type: 'double',
            title: 'Sensitivity',
            subtitle: 'Degrees of lean per pixel of horizontal displacement.',
            min: 0.01, max: 0.5, step: 0.01, digits: 2,
        },
        {
            key: 'swing-smoothing',
            type: 'double',
            title: 'Smoothing',
            subtitle: 'Lower values make the lean lag behind the pointer.',
            min: 0.05, max: 1.0, step: 0.05, digits: 2,
        },
    ];

    start(ctx) {
        this._originX = ctx.x;
        this._angle = ctx.actor.rotation_angle_z;
    }

    update(ctx, frame) {
        const max = readInt(this.settings, 'swing-max-angle', 15);
        const sensitivity = readDouble(this.settings, 'swing-sensitivity', 0.12);
        const smoothing = readDouble(this.settings, 'swing-smoothing', 0.2);

        const offset = ctx.x - this._originX;
        const target = clamp(-offset * sensitivity, -max, max);

        this._angle += (target - this._angle) *
            alphaFor(smoothing, timeScale(ctx.dt));

        frame.rotationZ += this._angle;
    }
}
