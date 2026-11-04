// Safe GSettings access: if a key is not declared in the schema yet, fall
// back to a default value so a new effect still works before its key is
// added to the .gschema.xml file.

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
