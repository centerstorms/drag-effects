// Drag Effects - Preferences
//
// Toàn bộ UI của phần hiệu ứng được sinh tự động từ EFFECTS (effects/index.js)
// và static controls của từng class. Thêm hiệu ứng mới không cần sửa file này.

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences}
    from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {EFFECTS} from './effects/index.js';
import {hasKey} from './lib/settings.js';

const PIVOT_OPTIONS = [
    {value: 'cursor', label: 'At the pointer'},
    {value: 'center', label: 'At the window center'},
];

// --------------------------------------------------------------- helpers

function props(title, subtitle, extra = {}) {
    const result = {title, ...extra};
    if (subtitle)
        result.subtitle = subtitle;
    return result;
}

function addSwitch(group, settings, key, title, subtitle = null, sensitiveTo = null) {
    const row = new Adw.SwitchRow(props(title, subtitle));

    settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);

    if (sensitiveTo)
        settings.bind(sensitiveTo, row, 'sensitive', Gio.SettingsBindFlags.GET);

    group.add(row);
    return row;
}

function addIntSpin(group, settings, key, opts) {
    const {
        title, subtitle = null, min, max,
        step = 1, sensitiveTo = null,
    } = opts;

    const row = new Adw.SpinRow(props(title, subtitle, {
        digits: 0,
        adjustment: new Gtk.Adjustment({
            lower: min,
            upper: max,
            step_increment: step,
            page_increment: step * 5,
        }),
    }));

    row.value = settings.get_int(key);

    row.connect('notify::value', () => {
        const value = Math.round(row.value);
        if (settings.get_int(key) !== value)
            settings.set_int(key, value);
    });

    settings.connect(`changed::${key}`, () => {
        const value = settings.get_int(key);
        if (Math.round(row.value) !== value)
            row.value = value;
    });

    if (sensitiveTo)
        settings.bind(sensitiveTo, row, 'sensitive', Gio.SettingsBindFlags.GET);

    group.add(row);
    return row;
}

function addDoubleSpin(group, settings, key, opts) {
    const {
        title, subtitle = null, min, max,
        step = 0.01, digits = 2, sensitiveTo = null,
    } = opts;

    const row = new Adw.SpinRow(props(title, subtitle, {
        digits,
        adjustment: new Gtk.Adjustment({
            lower: min,
            upper: max,
            step_increment: step,
            page_increment: step * 10,
        }),
    }));

    const precision = Math.pow(10, digits);
    const round = value => Math.round(value * precision) / precision;

    row.value = settings.get_double(key);

    row.connect('notify::value', () => {
        const value = round(row.value);
        if (Math.abs(settings.get_double(key) - value) > 1 / precision / 10)
            settings.set_double(key, value);
    });

    settings.connect(`changed::${key}`, () => {
        const value = settings.get_double(key);
        if (Math.abs(round(row.value) - value) > 1 / precision / 10)
            row.value = value;
    });

    if (sensitiveTo)
        settings.bind(sensitiveTo, row, 'sensitive', Gio.SettingsBindFlags.GET);

    group.add(row);
    return row;
}

function addCombo(group, settings, key, options, title, subtitle = null, sensitiveTo = null) {
    const row = new Adw.ComboRow(props(title, subtitle, {
        model: Gtk.StringList.new(options.map(option => option.label)),
    }));

    const sync = () => {
        const index = options.findIndex(option => option.value === settings.get_string(key));
        row.selected = index >= 0 ? index : 0;
    };

    sync();

    row.connect('notify::selected', () => {
        const option = options[row.selected];
        if (option && settings.get_string(key) !== option.value)
            settings.set_string(key, option.value);
    });

    settings.connect(`changed::${key}`, sync);

    if (sensitiveTo)
        settings.bind(sensitiveTo, row, 'sensitive', Gio.SettingsBindFlags.GET);

    group.add(row);
    return row;
}

// Build a control from an effect class descriptor.
function addControl(group, settings, control, sensitiveTo) {
    if (!hasKey(settings, control.key)) {
        log(`Drag Effects: key "${control.key}" is missing from the schema; skipping.`);
        return null;
    }

    switch (control.type) {
    case 'switch':
        return addSwitch(group, settings, control.key,
            control.title, control.subtitle ?? null, sensitiveTo);

    case 'int':
        return addIntSpin(group, settings, control.key, {
            title: control.title,
            subtitle: control.subtitle ?? null,
            min: control.min ?? 0,
            max: control.max ?? 100,
            step: control.step ?? 1,
            sensitiveTo,
        });

    case 'double':
        return addDoubleSpin(group, settings, control.key, {
            title: control.title,
            subtitle: control.subtitle ?? null,
            min: control.min ?? 0,
            max: control.max ?? 10,
            step: control.step ?? 0.01,
            digits: control.digits ?? 2,
            sensitiveTo,
        });

    case 'enum':
        return addCombo(group, settings, control.key,
            control.options ?? [], control.title,
            control.subtitle ?? null, sensitiveTo);

    default:
        log(`Drag Effects: control type "${control.type}" is not supported.`);
        return null;
    }
}

// --------------------------------------------------------------- window

export default class DragEffectsPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        window.set_default_size(660, 840);
        window.search_enabled = true;

        window.add(this._buildEffectsPage(settings));
        window.add(this._buildCommonPage(settings));
        window.add(this._buildExtendPage(settings));
    }

    // First page: one group per effect in the registry.
    _buildEffectsPage(settings) {
        const page = new Adw.PreferencesPage({
            title: 'Effects',
            icon_name: 'applications-graphics-symbolic',
        });

        if (EFFECTS.length === 0) {
            const group = new Adw.PreferencesGroup({
                title: 'No effects yet',
                description: 'Add a class to EFFECTS in effects/index.js.',
            });
            page.add(group);
            return page;
        }

        for (const EffectClass of EFFECTS) {
            const enabledKey = `effect-${EffectClass.id}-enabled`;
            const hasSwitch = hasKey(settings, enabledKey);

            const group = new Adw.PreferencesGroup({
                title: EffectClass.title,
                description: EffectClass.description,
            });
            page.add(group);

            if (hasSwitch)
                addSwitch(group, settings, enabledKey, 'Enable effect');

            for (const control of EffectClass.controls ?? [])
                addControl(group, settings, control, hasSwitch ? enabledKey : null);
        }

        return page;
    }

    // Common page: engine settings that do not belong to any effect.
    _buildCommonPage(settings) {
        const page = new Adw.PreferencesPage({
            title: 'General',
            icon_name: 'preferences-system-symbolic',
        });

        const motion = new Adw.PreferencesGroup({
            title: 'Motion',
            description: 'Applies to every enabled effect.',
        });
        page.add(motion);

        addCombo(motion, settings, 'pivot-mode', PIVOT_OPTIONS, 'Transform origin',
            'Rotate and scale around the pointer or around the window center.');

        addSwitch(motion, settings, 'release-wobble', 'Settle with a bounce',
            'Use an overshoot easing when the window returns to normal.');

        addIntSpin(motion, settings, 'release-duration', {
            title: 'Release duration',
            subtitle: 'Milliseconds. 0 disables the release animation.',
            min: 0, max: 1000, step: 20,
        });

        const performance = new Adw.PreferencesGroup({
            title: 'Performance',
            description: 'Applies to the next drag.',
        });
        page.add(performance);

        addIntSpin(performance, settings, 'frame-interval', {
            title: 'Update interval',
            subtitle: 'Milliseconds. 16 ms is roughly 60 FPS.',
            min: 8, max: 50, step: 2,
        });

        const filter = new Adw.PreferencesGroup({title: 'Window filtering'});
        page.add(filter);

        addSwitch(filter, settings, 'only-normal-windows',
            'Normal application windows only',
            'Skip dialogs, popups, docks, and utility windows.');

        addSwitch(filter, settings, 'skip-maximized',
            'Skip fullscreen windows',
            'Maximized windows still animate: dragging one out unmaximizes it.');

        const reset = new Adw.PreferencesGroup({
            title: 'Reset',
            description: 'Reset every key in the schema to its default.',
        });
        page.add(reset);

        const row = new Adw.ActionRow({
            title: 'Restore defaults',
            subtitle: 'Does not affect windows that are already open.',
        });

        const button = new Gtk.Button({
            label: 'Reset',
            valign: Gtk.Align.CENTER,
            css_classes: ['destructive-action'],
        });

        button.connect('clicked', () => {
            try {
                for (const key of settings.settings_schema.list_keys())
                    settings.reset(key);
            } catch (e) {
                logError(e);
            }
        });

        row.add_suffix(button);
        row.activatable_widget = button;
        reset.add(row);

        const support = new Adw.PreferencesGroup({
            title: 'Buy me a coffee',
            description: 'Drag Effects is free and open source. ' +
                'If it is useful to you, you can support its development.',
        });
        page.add(support);

        const coffee = new Adw.ActionRow({
            title: 'Buy me a coffee',
            subtitle: 'https://ko-fi.com/centerstorms',
        });

        const donate = new Gtk.LinkButton({
            label: 'Donate',
            uri: 'https://ko-fi.com/centerstorms',
            valign: Gtk.Align.CENTER,
        });

        coffee.add_suffix(donate);
        coffee.activatable_widget = donate;
        support.add(coffee);

        return page;
    }

    // Extension guide page.
    _buildExtendPage(_settings) {
        const page = new Adw.PreferencesPage({
            title: 'Extend',
            icon_name: 'applications-engineering-symbolic',
        });

        const group = new Adw.PreferencesGroup({
            title: 'Add a new effect',
            description: 'Copy effects/_template.js, declare its keys in ' +
                'schemas/*.gschema.xml, then add the class to effects/index.js. ' +
                'extension.js and prefs.js do not need changes.',
        });
        page.add(group);

        const folder = new Adw.ActionRow({
            title: 'Extension folder',
            subtitle: this.path,
        });

        const open = new Gtk.Button({
            label: 'Open',
            valign: Gtk.Align.CENTER,
        });

        open.connect('clicked', () => {
            try {
                Gio.AppInfo.launch_default_for_uri(this.dir.get_uri(), null);
            } catch (e) {
                logError(e);
            }
        });

        folder.add_suffix(open);
        folder.activatable_widget = open;
        group.add(folder);

        const reload = new Adw.PreferencesGroup({title: 'After editing code'});
        page.add(reload);

        reload.add(new Adw.ActionRow({
            title: 'Restart GNOME Shell',
            subtitle: 'Wayland: log out and back in. X11: Alt+F2, then r, then Enter.',
        }));

        return page;
    }
}
