// Hiệu ứng: nghiêng 3D.
// Ghi vào frame.rotationX / frame.rotationY.
//
// Clutter chiếu rotation_angle_x/y qua perspective của stage nên cửa sổ có
// cảm giác nghiêng trong không gian thay vì chỉ bị bóp méo 2D.

import {DragEffect, alphaFor, timeScale} from '../lib/effect.js';
import {readDouble, readInt} from '../lib/settings.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class Tilt3DEffect extends DragEffect {
    static id = 'tilt3d';
    static title = '3D tilt';
    static description = 'The window tilts around the X and Y axes with drag direction, adding a sense of depth.';

    static controls = [
        {
            key: 'tilt3d-max-angle',
            type: 'int',
            title: 'Maximum tilt angle',
            subtitle: 'Degrees.',
            min: 1, max: 45, step: 1,
        },
        {
            key: 'tilt3d-sensitivity',
            type: 'double',
            title: 'Sensitivity',
            subtitle: 'Degrees per pixel of pointer movement per frame.',
            min: 0.05, max: 3.0, step: 0.05,
        },
        {
            key: 'tilt3d-smoothing',
            type: 'double',
            title: 'Smoothing',
            subtitle: 'Lower values make the window lag behind the pointer.',
            min: 0.05, max: 1.0, step: 0.05,
        },
    ];

    start(ctx) {
        this._yaw = ctx.actor.rotation_angle_y;
        this._pitch = ctx.actor.rotation_angle_x;
    }

    update(ctx, frame) {
        const max = readInt(this.settings, 'tilt3d-max-angle', 18);
        const sensitivity = readDouble(this.settings, 'tilt3d-sensitivity', 0.5);
        const smoothing = readDouble(this.settings, 'tilt3d-smoothing', 0.2);
        const alpha = alphaFor(smoothing, timeScale(ctx.dt));

        // Kéo ngang -> xoay quanh trục Y; kéo dọc -> xoay quanh trục X.
        const yawTarget = clamp(ctx.dx * sensitivity, -max, max);
        const pitchTarget = clamp(-ctx.dy * sensitivity, -max, max);

        this._yaw += (yawTarget - this._yaw) * alpha;
        this._pitch += (pitchTarget - this._pitch) * alpha;

        frame.rotationY += this._yaw;
        frame.rotationX += this._pitch;
    }
}
