// Hiệu ứng: phóng theo tốc độ.
// Ghi vào frame.scaleX / frame.scaleY.
//
// Khác với "lift" (phóng cố định), hiệu ứng này chỉ phóng khi chuột đang
// di chuyển nhanh, và trả về 1:1 khi ngừng tay.

import {DragEffect, alphaFor, timeScale} from '../lib/effect.js';
import {readDouble, readInt} from '../lib/settings.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class SpeedZoomEffect extends DragEffect {
    static id = 'speed-zoom';
    static title = 'Speed zoom';
    static description = 'The window zooms slightly while dragged quickly and returns to its real size as you slow down.';

    static controls = [
        {
            key: 'speed-zoom-max',
            type: 'int',
            title: 'Maximum zoom',
            subtitle: 'Percent.',
            min: 0, max: 25, step: 1,
        },
        {
            key: 'speed-zoom-strength',
            type: 'double',
            title: 'Speed sensitivity',
            subtitle: 'Zoom per pixel of pointer movement per frame.',
            min: 0.001, max: 0.05, step: 0.001, digits: 3,
        },
        {
            key: 'speed-zoom-smoothing',
            type: 'double',
            title: 'Smoothing',
            min: 0.05, max: 1.0, step: 0.05,
        },
    ];

    start() {
        this._factor = 0;
    }

    update(ctx, frame) {
        const max = readInt(this.settings, 'speed-zoom-max', 8) / 100;
        const strength = readDouble(this.settings, 'speed-zoom-strength', 0.004);
        const smoothing = readDouble(this.settings, 'speed-zoom-smoothing', 0.25);

        const speed = Math.hypot(ctx.dx, ctx.dy);
        const target = clamp(speed * strength, 0, max);

        this._factor += (target - this._factor) * alphaFor(smoothing, timeScale(ctx.dt));

        const scale = 1 + this._factor;
        frame.scaleX *= scale;
        frame.scaleY *= scale;
    }
}
