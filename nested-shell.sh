#!/usr/bin/env bash
# nested-shell.sh — test Drag Effects in a nested GNOME Shell without
# logging out of the main session.
#
#   ./nested-shell.sh              # install + run nested + open Preferences
#   ./nested-shell.sh --no-prefs   # do not open Preferences automatically
#   ./nested-shell.sh -v           # print the full shell log
#
# Requires a Wayland session and GNOME Shell 45+.
# GNOME 49+ uses `--devkit` and needs the mutter-devkit package (usually
# shipped with gnome-shell on recent distributions; the script explains how
# to install it if it is missing).

set -euo pipefail

UUID="drag-effects@centerstorms.github.io"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG="${TMPDIR:-/tmp}/drag-effects-nested.log"

# Inside a Flatpak sandbox, XDG_DATA_HOME points at app-private data, which
# the host GNOME Shell cannot see. Always use ~/.local/share there; outside
# a sandbox, respect XDG_DATA_HOME.
if [ -f /.flatpak-info ]; then
    DATA_HOME="$HOME/.local/share"
else
    DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
fi
DEST="$DATA_HOME/gnome-shell/extensions/$UUID"

OPEN_PREFS=1
DO_INSTALL=1
VERBOSE=0

usage() {
    cat <<EOF
Usage: $(basename "$0") [options]

  -p, --prefs        open Preferences in the nested shell (default)
      --no-prefs     do not open Preferences automatically
  -n, --no-install   do not run ./install.sh first
  -v, --verbose      print the full log (errors/effects only by default)
  -h, --help         show this help
EOF
}

while [ $# -gt 0 ]; do
    case "$1" in
        -p|--prefs)       OPEN_PREFS=1 ;;
        --no-prefs)       OPEN_PREFS=0 ;;
        -n|--no-install)  DO_INSTALL=0 ;;
        -v|--verbose)     VERBOSE=1 ;;
        -h|--help)        usage; exit 0 ;;
        *)
            echo "Invalid option: $1" >&2
            usage >&2
            exit 2
            ;;
    esac
    shift
done

say() { printf '%s\n' "$*"; }
die() { printf 'Error: %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------- install
if [ "$DO_INSTALL" -eq 1 ]; then
    say "== Installing extension =="
    install_log="${LOG%.log}-install.log"
    if ! XDG_DATA_HOME="$DATA_HOME" "$HERE/install.sh" install >"$install_log" 2>&1; then
        cat "$install_log" >&2
        die "Extension installation failed (see $install_log)."
    fi
    say "Installed: $DEST"
fi

[ -f "$DEST/metadata.json" ] ||
    die "Cannot find $DEST — run ./install.sh first."

if [ ! -f "$DEST/schemas/gschemas.compiled" ]; then
    glib-compile-schemas "$DEST/schemas" ||
        die "Could not compile the schema in $DEST/schemas."
fi

# ------------------------------------------------------ environment checks
if [ -f /.flatpak-info ] && ! command -v gnome-shell >/dev/null 2>&1; then
    cat >&2 <<EOF
The extension was installed to:
  $DEST

But this script is running inside a Flatpak sandbox (no gnome-shell).
Run it again from a GNOME terminal on the desktop:

  "$HERE/nested-shell.sh"
EOF
    exit 1
fi

for cmd in gnome-shell gnome-extensions dbus-run-session gsettings; do
    command -v "$cmd" >/dev/null 2>&1 || die "Missing command '$cmd'."
done

session="${XDG_SESSION_TYPE:-}"
if [ -z "$session" ] && [ -n "${WAYLAND_DISPLAY:-}" ]; then
    session="wayland"
fi

if [ "$session" != "wayland" ]; then
    cat >&2 <<EOF
The nested shell only runs on a Wayland session (current: ${session:-unknown}).

To test on X11 without logging out:
  1. "$HERE/install.sh"
  2. Alt+F2 → type "r" → Enter
  3. gnome-extensions enable $UUID
EOF
    exit 1
fi

# --------------------------------------------------------- conflict warning
enabled_list="$(gsettings get org.gnome.shell enabled-extensions 2>/dev/null || true)"

case "$enabled_list" in
    *drag-fx@example.com*)
        say "Warning: 'drag-fx@example.com' (the older extension) is enabled — disable it to avoid conflicts."
        ;;
esac

case "$enabled_list" in
    *compiz*|*wobbly*)
        say "Warning: another window-effect extension is enabled — window transforms may conflict."
        ;;
esac

# -------------------------------------------------------- choose nested mode
version="$(gnome-shell --version 2>/dev/null | grep -oE '[0-9]+' | head -n 1 || true)"
[ -n "$version" ] || die "Could not read the GNOME Shell version."

if [ "$version" -ge 49 ]; then
    MODE="devkit"
    if ! command -v mutter-devkit >/dev/null 2>&1 &&
       [ ! -x /usr/libexec/mutter-devkit ] &&
       [ ! -x /usr/lib/mutter-devkit ]; then
        cat >&2 <<EOF
GNOME $version uses "gnome-shell --devkit", but mutter-devkit was not found.

Install it and run the script again:
  Fedora:  sudo dnf install mutter-devkit
           (if the package is missing: sudo dnf provides '*/mutter-devkit')
  Arch:    sudo pacman -S mutter-devkit
  Ubuntu:  sudo apt install mutter-dev-bin

Alternatively, log out and back in to test the extension normally.
EOF
        exit 1
    fi
else
    MODE="nested"
fi

say "GNOME Shell $version → mode: $MODE"
say "Shell log: $LOG"
say "Extension log: ~/.cache/drag-effects.log"
say "Close the nested window to exit."

: >"$LOG"

export DE_UUID="$UUID"
export DE_MODE="$MODE"
export DE_LOG="$LOG"
export DE_PREFS="$OPEN_PREFS"
export DE_VERBOSE="$VERBOSE"

# ------------------------------------------------------------- run nested
set +e
dbus-run-session -- bash -c '
set -u

if [ "$DE_MODE" = "devkit" ]; then
    gnome-shell --devkit --wayland >"$DE_LOG" 2>&1 &
else
    gnome-shell --nested --wayland >"$DE_LOG" 2>&1 &
fi
shell_pid=$!

# Follow the log: by default, show only JS errors and extension messages.
if [ "$DE_VERBOSE" = "1" ]; then
    tail -n +1 -F "$DE_LOG" 2>/dev/null &
else
    tail -n +1 -F "$DE_LOG" 2>/dev/null \
        > >(grep --line-buffered -E "drag-effects|JS ERROR|ERROR|CRITICAL|TypeError|ReferenceError" >&2) &
fi
tail_pid=$!

cleanup() {
    kill "$tail_pid" 2>/dev/null || true
}
trap cleanup EXIT

ok=0
for _ in $(seq 1 300); do
    if ! kill -0 "$shell_pid" 2>/dev/null; then
        echo "The nested GNOME Shell exited early. See $DE_LOG" >&2
        exit 1
    fi

    if gnome-extensions enable "$DE_UUID" 2>/dev/null; then
        ok=1
        echo "Enabled $DE_UUID in the nested shell."
        break
    fi

    sleep 0.2
done

if [ "$ok" -eq 0 ]; then
    echo "Could not enable the extension over D-Bus." >&2
    echo "Open a terminal inside the nested shell and run:" >&2
    echo "  gnome-extensions enable $DE_UUID" >&2
elif [ "$DE_PREFS" = "1" ]; then
    sleep 0.5

    # Preferences must open on the nested Wayland display; otherwise the
    # window appears in the main session and dragging it does not trigger the
    # extension inside the nested shell.
    nested_display="$(grep "Using Wayland display name" "$DE_LOG" \
        | tail -n 1 | sed "s/.*name //" | sed "s/[^A-Za-z0-9-]//g")"
    if [ -z "$nested_display" ]; then
        nested_display="$(grep -o "WAYLAND_DISPLAY=[^ ]*" "$DE_LOG" \
            | tail -n 1 | sed "s/WAYLAND_DISPLAY=//")"
    fi

    if [ -n "$nested_display" ]; then
        echo "Opening Preferences in the nested shell (WAYLAND_DISPLAY=$nested_display)."
        echo "Drag the Preferences window to test the effects."
        WAYLAND_DISPLAY="$nested_display" \
            gnome-extensions prefs "$DE_UUID" >/dev/null 2>&1 &
    else
        echo "Could not read the nested Wayland display." >&2
        echo "Open an app inside the nested shell and drag that window instead." >&2
        gnome-extensions prefs "$DE_UUID" >/dev/null 2>&1 &
    fi
fi

wait "$shell_pid"
'
status=$?
set -e

say "Nested shell closed (status $status)."

if [ "$status" -ne 0 ]; then
    say "--- last 40 log lines ---"
    tail -n 40 "$LOG" || true
fi

exit "$status"
