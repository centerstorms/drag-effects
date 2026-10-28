#!/usr/bin/env bash
# Install or uninstall the Drag Effects extension (GNOME Shell 45+).

set -euo pipefail

UUID="drag-effects@example.com"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
DEST="$DATA_HOME/gnome-shell/extensions/$UUID"

usage() {
    echo "Usage: $0 [install|uninstall]"
    exit 1
}

uninstall() {
    rm -rf "$DEST"
    echo "Removed: $DEST"
    echo "Wayland: log out and back in. X11: Alt+F2 -> r -> Enter."
}

install() {
    if ! command -v glib-compile-schemas >/dev/null 2>&1; then
        echo "glib-compile-schemas is missing (package libglib2.0-bin / glib2)." >&2
        exit 1
    fi

    mkdir -p "$DEST/schemas" "$DEST/lib" "$DEST/effects"
    cp "$HERE/metadata.json" "$HERE/extension.js" "$HERE/prefs.js" "$HERE/lg-hook.js" "$DEST/"
    cp "$HERE/lib/"*.js "$DEST/lib/"
    cp "$HERE/effects/"*.js "$DEST/effects/"

    rm -f "$DEST/schemas/"*.gschema.xml "$DEST/schemas/gschemas.compiled"
    cp "$HERE/schemas/"*.gschema.xml "$DEST/schemas/"
    glib-compile-schemas "$DEST/schemas"

    echo "Installed: $DEST"
    echo
    echo "Next steps:"
    echo "  - Wayland: log out and back in."
    echo "  - X11:     Alt+F2 -> type \"r\" -> Enter."
    echo "  - Enable:  gnome-extensions enable $UUID"
    echo "  - Configure: gnome-extensions prefs $UUID"
}

case "${1:-install}" in
    install)   install ;;
    uninstall) uninstall ;;
    *)         usage ;;
esac
