// Effect: 3D wobble.
// Writes frame.rotationY.
//
// Unlike tilt3d (which follows horizontal velocity), this effect adds a
// low-frequency side-to-side oscillation while the window is moving. It is
// deliberately subtle and decays as the pointer slows down.

import {DragEffect, alphaFor, timeScale} from '../lib/effect.js';
import {readDouble, readInt} from '../lib/settings.js';

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class WobbleEffect extends DragEffect {
    static id = 'wobble';
    static title = 'Wobble';
    static description = 'A gentle side-to-side 3D wobble that follows drag speed.';

    static controls = [
        {
            key: 'wobble-max-angle',
            type: 'int',
            title: 'Maximum angle',
            subtitle: 'Degrees.',
            min: 1, max: 30, step: 1,
        },
        {
            key: 'wobble-frequency',
            type: 'double',
            title: 'Frequency',
            subtitle: 'Wobbles per second (Hz).',
            min: 1.0, max: 10.0, step: 0.1, digits: 1,
        },
        {
            key: 'wobble-sensitivity',
            type: 'double',
            title: 'Speed sensitivity',
            subtitle: 'How much speed is converted into wobble amplitude.',
            min: 0.02, max: 1.0, step: 0.02, digits: 2,
        },
        {
            key: 'wobble-smoothing',
            type: 'double',
            title: 'Smoothing',
            subtitle: 'Lower values make the wobble follow speed more slowly.',
            min: 0.05, max: 1.0, step: 0.05, digits: 2,
        },
    ];

    start(ctx) {
        this._angle = ctx.actor.rotation_angle_y;
        this._phase = 0;
        this._amplitude = 0;
    }

    update(ctx, frame) {
        const max = readInt(this.settings, 'wobble-max-angle', 12);
        const frequency = readDouble(this.settings, 'wobble-frequency', 3.5);
        const sensitivity = readDouble(this.settings, 'wobble-sensitivity', 0.25);
        const smoothing = readDouble(this.settings, 'wobble-smoothing', 0.18);

        const speed = Math.hypot(ctx.dx, ctx.dy);
        const targetAmplitude = clamp(speed * sensitivity, 0, max);

        this._amplitude += (targetAmplitude - this._amplitude) *
            alphaFor(smoothing, timeScale(ctx.dt));
        this._phase += TAU * frequency * (ctx.dt / 1000);

        const target = this._amplitude * Math.sin(this._phase);
        this._angle += (target - this._angle) *
            alphaFor(0.35, timeScale(ctx.dt));

        frame.rotationY += this._angle;
    }
}
