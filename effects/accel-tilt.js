// Hiệu ứng: nghiêng theo gia tốc.
// Ghi vào frame.rotationZ.
//
// Khác "tilt" (theo vận tốc): hiệu ứng này phản ứng với thay đổi tốc độ,
// nên cửa sổ chỉ nghiêng khi tăng/giảm tốc đột ngột rồi nhanh chóng ổn định.

import {DragEffect, alphaFor, timeScale} from '../lib/effect.js';
import {readDouble, readInt} from '../lib/settings.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class AccelTiltEffect extends DragEffect {
    static id = 'accel-tilt';
    static title = 'Acceleration tilt';
    static description = 'The window tilts with pointer acceleration rather than speed.';

    static controls = [
        {
            key: 'accel-tilt-max-angle',
            type: 'int',
            title: 'Maximum angle',
            subtitle: 'Degrees.',
            min: 1, max: 20, step: 1,
        },
        {
            key: 'accel-tilt-sensitivity',
            type: 'double',
            title: 'Sensitivity',
            subtitle: 'Degrees per pixel of velocity change per frame.',
            min: 0.05, max: 2.0, step: 0.05,
        },
        {
            key: 'accel-tilt-smoothing',
            type: 'double',
            title: 'Smoothing',
            min: 0.05, max: 1.0, step: 0.05,
        },
    ];

    start(ctx) {
        this._prevDx = 0;
        this._angle = ctx.actor.rotation_angle_z;
    }

    update(ctx, frame) {
        const max = readInt(this.settings, 'accel-tilt-max-angle', 6);
        const sensitivity = readDouble(this.settings, 'accel-tilt-sensitivity', 0.4);
        const smoothing = readDouble(this.settings, 'accel-tilt-smoothing', 0.25);

        const acceleration = ctx.dx - this._prevDx;
        this._prevDx = ctx.dx;

        const target = clamp(-acceleration * sensitivity, -max, max);
        this._angle += (target - this._angle) *
            alphaFor(smoothing, timeScale(ctx.dt));

        frame.rotationZ += this._angle;
    }
}
