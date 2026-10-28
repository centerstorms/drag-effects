// Hiệu ứng: lò xo.
// Ghi vào frame.rotationZ.
//
// Cửa sổ xoay như được gắn vào một lò xo: bám theo hướng kéo, vượt qua
// đích rồi dao động tắt dần (overshoot) thay vì bám cứng như "tilt".

import {DragEffect} from '../lib/effect.js';
import {readDouble, readInt} from '../lib/settings.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class SpringEffect extends DragEffect {
    static id = 'spring';
    static title = 'Spring';
    static description = 'The window oscillates elastically around the drag direction before settling.';

    static controls = [
        {
            key: 'spring-max-angle',
            type: 'int',
            title: 'Maximum angle',
            subtitle: 'Degrees.',
            min: 1, max: 30, step: 1,
        },
        {
            key: 'spring-sensitivity',
            type: 'double',
            title: 'Sensitivity',
            subtitle: 'Target angle per pixel of pointer movement per frame.',
            min: 0.05, max: 2.0, step: 0.05,
        },
        {
            key: 'spring-stiffness',
            type: 'double',
            title: 'Stiffness',
            subtitle: 'Higher values follow motion more closely.',
            min: 0.02, max: 0.6, step: 0.02,
        },
        {
            key: 'spring-damping',
            type: 'double',
            title: 'Damping',
            subtitle: 'Closer to 1 means oscillations last longer.',
            min: 0.1, max: 0.98, step: 0.02,
        },
    ];

    start(ctx) {
        this._angle = ctx.actor.rotation_angle_z;
        this._velocity = 0;
    }

    update(ctx, frame) {
        const max = readInt(this.settings, 'spring-max-angle', 12);
        const sensitivity = readDouble(this.settings, 'spring-sensitivity', 0.5);
        const stiffness = readDouble(this.settings, 'spring-stiffness', 0.3);
        const damping = readDouble(this.settings, 'spring-damping', 0.8);

        const target = clamp(ctx.dx * sensitivity, -max, max);

        // Chia khung dài thành nhiều bước nhỏ để tích phân ổn định, và để tốc
        // độ dao động không phụ thuộc frame-interval.
        const steps = Math.min(4, Math.max(1, Math.round(ctx.dt / 16.67)));
        const stepK = Math.min(2, Math.max(0.1, (ctx.dt / steps) / 16.67));

        for (let i = 0; i < steps; i++) {
            this._velocity += (target - this._angle) * stiffness * stepK;
            this._velocity *= Math.pow(damping, stepK);
            this._angle += this._velocity * stepK;

            if (this._angle > max) {
                this._angle = max;
                this._velocity = 0;
            } else if (this._angle < -max) {
                this._angle = -max;
                this._velocity = 0;
            }
        }

        frame.rotationZ += this._angle;
    }
}
