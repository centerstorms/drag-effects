// Hiệu ứng: nhịp thở.
// Ghi vào frame.scaleX / frame.scaleY.
//
// Phóng/thu rất nhẹ theo chu kỳ, giúp cửa sổ "sống" trong lúc kéo. Amplitude
// nhỏ nên có thể bật cùng các hiệu ứng khác.

import {DragEffect} from '../lib/effect.js';
import {readDouble, readInt} from '../lib/settings.js';

const TAU = Math.PI * 2;

export class PulseEffect extends DragEffect {
    static id = 'pulse';
    static title = 'Pulse';
    static description = 'The window pulses very slightly while being dragged.';

    static controls = [
        {
            key: 'pulse-amplitude',
            type: 'int',
            title: 'Amplitude',
            subtitle: 'Percent of window size.',
            min: 0, max: 5, step: 1,
        },
        {
            key: 'pulse-frequency',
            type: 'double',
            title: 'Frequency',
            subtitle: 'Hz. 1.2 ~ 72 nhịp mỗi phút.',
            min: 0.2, max: 4.0, step: 0.1, digits: 1,
        },
    ];

    start() {
        // Bắt đầu ở 0 để không giật khi vừa bấm chuột.
        this._phase = 0;
    }

    update(ctx, frame) {
        const amplitude = readInt(this.settings, 'pulse-amplitude', 1) / 100;
        const frequency = readDouble(this.settings, 'pulse-frequency', 1.2);

        this._phase += TAU * frequency * (ctx.dt / 1000);

        const scale = 1 + amplitude * Math.sin(this._phase);
        frame.scaleX *= scale;
        frame.scaleY *= scale;
    }
}
