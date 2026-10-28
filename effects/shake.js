// Hiệu ứng: rung.
// Ghi vào frame.rotationZ.
//
// Amplitude rung tỉ lệ với tốc độ kéo và tắt dần khi ngừng tay. Frequency tính
// theo thời gian thực (Hz) nên không phụ thuộc frame-interval.

import {DragEffect, alphaFor, timeScale} from '../lib/effect.js';
import {readDouble, readInt} from '../lib/settings.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const TAU = Math.PI * 2;

export class ShakeEffect extends DragEffect {
    static id = 'shake';
    static title = 'Shake';
    static description = 'The window shakes gently during fast drags and calms down as the pointer slows.';

    static controls = [
        {
            key: 'shake-max-angle',
            type: 'int',
            title: 'Maximum amplitude',
            subtitle: 'Degrees.',
            min: 0, max: 15, step: 1,
        },
        {
            key: 'shake-frequency',
            type: 'double',
            title: 'Frequency',
            subtitle: 'Hz.',
            min: 1, max: 20, step: 0.5, digits: 1,
        },
        {
            key: 'shake-sensitivity',
            type: 'double',
            title: 'Speed sensitivity',
            subtitle: 'Amplitude in degrees per pixel of pointer movement per frame.',
            min: 0.02, max: 1.0, step: 0.02,
        },
        {
            key: 'shake-smoothing',
            type: 'double',
            title: 'Amplitude smoothing',
            min: 0.05, max: 1.0, step: 0.05,
        },
    ];

    start() {
        this._phase = 0;
        this._amplitude = 0;
    }

    update(ctx, frame) {
        const max = readInt(this.settings, 'shake-max-angle', 3);
        const frequency = readDouble(this.settings, 'shake-frequency', 12);
        const sensitivity = readDouble(this.settings, 'shake-sensitivity', 0.15);
        const smoothing = readDouble(this.settings, 'shake-smoothing', 0.15);

        this._phase += TAU * frequency * (ctx.dt / 1000);

        const speed = Math.hypot(ctx.dx, ctx.dy);
        const target = clamp(speed * sensitivity, 0, max);
        this._amplitude += (target - this._amplitude) *
            alphaFor(smoothing, timeScale(ctx.dt));

        frame.rotationZ += Math.sin(this._phase) * this._amplitude;
    }
}
