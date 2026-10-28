// Effect: speed fade.
// Writes frame.opacity.
//
// The window becomes more transparent the faster it is dragged, then fades
// back as it slows down. Unlike the fixed opacity effect, this is reactive.

import {DragEffect, alphaFor, timeScale} from '../lib/effect.js';
import {readDouble, readInt} from '../lib/settings.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class FadeSpeedEffect extends DragEffect {
    static id = 'fade-speed';
    static title = 'Speed fade';
    static description = 'Fades the window out while you drag quickly and restores it when you slow down.';

    static controls = [
        {
            key: 'fade-speed-min',
            type: 'int',
            title: 'Minimum opacity',
            subtitle: 'Percent. The window never becomes more transparent than this.',
            min: 30, max: 100, step: 5,
        },
        {
            key: 'fade-speed-strength',
            type: 'double',
            title: 'Speed sensitivity',
            subtitle: 'How quickly opacity falls as drag speed increases.',
            min: 0.001, max: 0.05, step: 0.001, digits: 3,
        },
        {
            key: 'fade-speed-smoothing',
            type: 'double',
            title: 'Smoothing',
            subtitle: 'Lower values make opacity follow speed more slowly.',
            min: 0.05, max: 1.0, step: 0.05, digits: 2,
        },
    ];

    start(ctx) {
        this._opacity = ctx.actor.opacity;
    }

    update(ctx, frame) {
        const min = readInt(this.settings, 'fade-speed-min', 70) / 100;
        const strength = readDouble(this.settings, 'fade-speed-strength', 0.006);
        const smoothing = readDouble(this.settings, 'fade-speed-smoothing', 0.2);

        const speed = Math.hypot(ctx.dx, ctx.dy);
        const fade = clamp(speed * strength, 0, 1 - min);
        const target = Math.round(255 * (1 - fade));

        this._opacity += (target - this._opacity) *
            alphaFor(smoothing, timeScale(ctx.dt));

        frame.opacity = Math.min(frame.opacity, this._opacity);
    }
}
