// Write diagnostic logs to ~/.cache/drag-effects.log.
//
// The engine and the shell-side Clutter effects use this helper. It only
// depends on Gio/GLib, which are also available in the Preferences process,
// and it is never called from prefs.js.
//
// The log is cleared every time the extension is enabled, so it only contains
// data from the current session. Read it with:
//   cat ~/.cache/drag-effects.log

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const LOG_FILE = Gio.File.new_for_path(GLib.build_filenamev([
    GLib.get_user_cache_dir(),
    'drag-effects.log',
]));

export function resetDebugLog() {
    try {
        LOG_FILE.delete(null);
    } catch (e) {
        // Chưa có file hoặc không có quyền: bỏ qua.
    }
}

export function debugLog(message) {
    try {
        let old = '';
        try {
            const [ok, contents] = LOG_FILE.load_contents(null);
            if (ok)
                old = new TextDecoder().decode(contents);
        } catch (e) {
            // Lần ghi đầu tiên: file chưa tồn tại.
        }

        const line = `[${new Date().toISOString()}] ${message}\n`;
        LOG_FILE.replace_contents(
            new TextEncoder().encode(old + line),
            null, false, Gio.FileCreateFlags.NONE, null);
    } catch (e) {
        // Không để lỗi ghi log ảnh hưởng tới hiệu ứng.
    }
}
