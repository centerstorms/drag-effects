// Hiệu ứng 4: làm cửa sổ hơi trong suốt trong lúc kéo.
// Ghi vào frame.opacity (0..255).

import {DragEffect, alphaFor, timeScale} from '../lib/effect.js';
import {readDouble, readInt} from '../lib/settings.js';

export class OpacityEffect extends DragEffect {
    static id = 'opacity';
    static title = 'Fade';
    static description = 'The window becomes slightly transparent while dragging so you can see what is behind it.';

    static controls = [
        {
            key: 'drag-opacity',
            type: 'int',
            title: 'Opacity',
            subtitle: 'Percent.',
            min: 40, max: 100, step: 5,
        },
        {
            key: 'opacity-smoothing',
            type: 'double',
            title: 'Smoothing',
            min: 0.05, max: 1.0, step: 0.05,
        },
    ];

    start(ctx) {
        this._value = ctx.actor.opacity;
    }

    update(ctx, frame) {
        const target = Math.round(255 * readInt(this.settings, 'drag-opacity', 95) / 100);
        const smoothing = readDouble(this.settings, 'opacity-smoothing', 0.2);

        this._value += (target - this._value) * alphaFor(smoothing, timeScale(ctx.dt));

        frame.opacity = this._value;
    }
}
