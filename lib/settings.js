// Đọc GSettings an toàn: nếu key chưa được khai báo trong schema thì dùng
// giá trị mặc định. Nhờ vậy một hiệu ứng mới vẫn chạy được trước khi ta kịp
// thêm key vào file .gschema.xml.

export function hasKey(settings, key) {
    try {
        return settings.settings_schema.has_key(key);
    } catch (e) {
        return false;
    }
}

export function readBoolean(settings, key, fallback = false) {
    return hasKey(settings, key) ? settings.get_boolean(key) : fallback;
}

export function readInt(settings, key, fallback = 0) {
    return hasKey(settings, key) ? settings.get_int(key) : fallback;
}

export function readDouble(settings, key, fallback = 0) {
    return hasKey(settings, key) ? settings.get_double(key) : fallback;
}

export function readString(settings, key, fallback = '') {
    return hasKey(settings, key) ? settings.get_string(key) : fallback;
}
