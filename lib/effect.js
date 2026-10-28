// Lớp cơ sở cho mọi hiệu ứng.
//
// Vòng đời:
//   enable()        - extension được bật
//   start(ctx)      - bắt đầu một lần kéo
//   update(ctx, f)  - mỗi khung hình trong lúc kéo
//   stop(ctx)       - thả chuột
//   disable()       - extension bị tắt
//
// ctx (DragContext) gồm:
//   actor, win          - Meta.WindowActor và Meta.Window
//   x, y                - vị trí chuột hiện tại (toạ độ stage)
//   dx, dy              - chuột di chuyển bao nhiêu pixel từ khung trước
//   dt                  - số ms từ khung trước
//   elapsed             - số ms từ lúc bắt đầu kéo
//   width, height       - kích thước actor
//   pivot               - tâm biến đổi dạng chuẩn hoá {x, y}
//   settings            - Gio.Settings
//
// Muốn thêm hiệu ứng: xem effects/_template.js

import {readBoolean} from './settings.js';

export class DragEffect {
    // --- metadata dùng cho registry + Preferences ---
    static id = 'effect';
    static title = 'Effect';
    static description = '';
    static controls = [];

    constructor(settings) {
        this.settings = settings;
    }

    get enabledKey() {
        return `effect-${this.constructor.id}-enabled`;
    }

    get enabled() {
        return readBoolean(this.settings, this.enabledKey, true);
    }

    // --- hooks ---
    enable() {}
    disable() {}
    start(_ctx) {}
    update(_ctx, _frame) {}
    stop(_ctx) {}
}

// Quy đổi hệ số theo dt để hiệu ứng không phụ thuộc vào tần số khung hình.
export function timeScale(dt) {
    return Math.min(4, Math.max(0.25, dt / 16.67));
}

// Chuyển "độ mượt mỗi khung" thành alpha tương ứng với dt thực tế.
export function alphaFor(smoothing, factor) {
    return 1 - Math.pow(1 - smoothing, factor);
}
