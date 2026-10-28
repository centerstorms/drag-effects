// Hiệu ứng: giảm bão hoà.
// Không ghi vào Frame: gắn Clutter.DesaturateEffect trực tiếp lên actor.
//
// API của Clutter.DesaturateEffect ổn định từ GNOME 45 đến 51 (chỉ dùng
// thuộc tính factor kiểu double), khác với ColorizeEffect đã đổi kiểu màu
// từ ClutterColor sang CoglColor nên tạm chưa dùng.
//
// LƯU Ý: prefs.js cũng import file này để đọc metadata, mà tiến trình
// Preferences không có typelib Clutter. Vì vậy KHÔNG được import Clutter ở
// top-level; chỉ tải động khi extension thực sự được bật.

import {DragEffect, alphaFor, timeScale} from '../lib/effect.js';
import {readDouble, readInt} from '../lib/settings.js';

const EFFECT_NAME = 'drag-effects-desaturate';

let Clutter = null;
let clutterLoading = false;

function loadClutter() {
    if (Clutter || clutterLoading)
        return;

    clutterLoading = true;
    import('gi://Clutter')
        .then(module => {
            Clutter = module.default;
        })
        .catch(e => {
            logError(e, 'Drag Effects: không tải được Clutter');
        })
        .then(() => {
            clutterLoading = false;
        });
}

export class DesaturateEffect extends DragEffect {
    static id = 'desaturate';
    static title = 'Desaturate';
    static description = 'The window loses saturation while dragging and returns to full color on release.';

    static controls = [
        {
            key: 'desaturate-factor',
            type: 'int',
            title: 'Desaturation amount',
            subtitle: 'Percent. 100% = fully grayscale.',
            min: 0, max: 100, step: 5,
        },
        {
            key: 'desaturate-smoothing',
            type: 'double',
            title: 'Smoothing',
            min: 0.05, max: 1.0, step: 0.05,
        },
    ];

    enable() {
        this._actor = null;
        this._effect = null;
        this._factor = 0;
        loadClutter();
    }

    start(ctx) {
        // Dọn effect còn sót từ lần kéo trước (nếu có), trước khi đổi actor.
        this._removeEffect();

        this._actor = ctx.actor;
        this._factor = 0;

        if (!Clutter) {
            // Lần kéo đầu tiên trước khi module Clutter tải xong: bỏ qua,
            // lần kéo sau sẽ có hiệu ứng.
            loadClutter();
            return;
        }

        let effect;
        try {
            effect = new Clutter.DesaturateEffect({factor: 0});
        } catch (e) {
            // Bản Clutter không hỗ trợ effect này: bỏ qua, không kéo sập engine.
            logError(e);
            return;
        }

        effect.factor = 0;

        try {
            // Tránh trùng tên nếu effect cũ chưa được gỡ vì lý do nào đó.
            this._actor.remove_effect_by_name(EFFECT_NAME);
        } catch (e) {
            // actor/effect đã bị huỷ
        }

        try {
            this._actor.add_effect_with_name(EFFECT_NAME, effect);
            this._effect = effect;
        } catch (e) {
            logError(e);
        }
    }

    update(ctx, _frame) {
        const effect = this._effect;
        if (!effect)
            return;

        const target = readInt(this.settings, 'desaturate-factor', 60) / 100;
        const smoothing = readDouble(this.settings, 'desaturate-smoothing', 0.2);

        this._factor += (target - this._factor) *
            alphaFor(smoothing, timeScale(ctx.dt));

        try {
            effect.factor = this._factor;
        } catch (e) {
            // Effect đã bị huỷ cùng actor.
            this._effect = null;
        }
    }

    stop(_ctx) {
        this._removeEffect();
        this._actor = null;
        this._factor = 0;
    }

    disable() {
        this._removeEffect();
        this._actor = null;
        this._factor = 0;
    }

    _removeEffect() {
        const actor = this._actor;
        const effect = this._effect;

        this._effect = null;

        if (!effect)
            return;

        try {
            if (actor)
                actor.remove_effect(effect);
            else
                effect.actor?.remove_effect(effect);
        } catch (e) {
            // Actor/effect đã bị huỷ (ví dụ cửa sổ đóng giữa lúc kéo).
        }
    }
}
