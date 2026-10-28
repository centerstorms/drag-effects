// Hiệu ứng: nén ngang.
// Ghi vào frame.scaleX / frame.scaleY.
//
// Kéo ngang nhanh -> cửa sổ hẹp lại và cao lên một chút (giữ thể tích),
// giống cảm giác vật liệu đàn hồi. Trục dọc do "stretch" đảm nhiệm.

import {DragEffect, alphaFor, timeScale} from '../lib/effect.js';
import {readDouble, readInt} from '../lib/settings.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class SquashEffect extends DragEffect {
    static id = 'squash';
    static title = 'Squash';
    static description = 'The window narrows during fast horizontal drags and grows slightly taller to compensate.';

    static controls = [
        {
            key: 'squash-max',
            type: 'int',
            title: 'Maximum squash',
            subtitle: 'Percent.',
            min: 0, max: 30, step: 1,
        },
        {
            key: 'squash-strength',
            type: 'double',
            title: 'Sensitivity',
            subtitle: 'Squash per pixel of pointer movement per frame.',
            min: 0.0005, max: 0.02, step: 0.0005, digits: 4,
        },
        {
            key: 'squash-smoothing',
            type: 'double',
            title: 'Smoothing',
            min: 0.05, max: 1.0, step: 0.05,
        },
    ];

    start() {
        this._amount = 0;
    }

    update(ctx, frame) {
        const max = readInt(this.settings, 'squash-max', 12) / 100;
        const strength = readDouble(this.settings, 'squash-strength', 0.005);
        const smoothing = readDouble(this.settings, 'squash-smoothing', 0.25);

        const target = clamp(Math.abs(ctx.dx) * strength, 0, max);
        this._amount += (target - this._amount) * alphaFor(smoothing, timeScale(ctx.dt));

        frame.scaleX *= 1 - this._amount;
        frame.scaleY *= 1 + this._amount * 0.5;
    }
}
