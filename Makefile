UUID      := drag-effects@centerstorms
SCHEMA    := org.gnome.shell.extensions.drag-effects
DIST      := dist
ZIP       := $(DIST)/$(UUID).shell-extension.zip

.PHONY: all schemas check check-release install uninstall enable disable \
        pack pack-gnome release nested clean

all: schemas

schemas: schemas/gschemas.compiled

schemas/gschemas.compiled: $(wildcard schemas/*.gschema.xml)
	glib-compile-schemas --strict schemas

check: schemas
	@python3 -m json.tool metadata.json >/dev/null
	@bash -n install.sh tools/package.sh tools/configure.sh
	@if [ -f nested-shell.sh ]; then bash -n nested-shell.sh; fi
	@python3 tools/check_extension.py

check-release:
	@if grep -q 'your-username' metadata.json; then \
		echo "error: replace the placeholder URL in metadata.json" >&2; \
		echo "       run ./tools/configure.sh centerstorms drag-effects" >&2; \
		exit 1; \
	fi
	@if grep -q '@example.com' metadata.json; then \
		echo "error: replace the development UUID in metadata.json" >&2; \
		echo "       run ./tools/configure.sh centerstorms drag-effects" >&2; \
		exit 1; \
	fi
	@$(MAKE) check

install:
	./install.sh install

uninstall:
	./install.sh uninstall

enable:
	gnome-extensions enable $(UUID)

disable:
	gnome-extensions disable $(UUID)

pack: check
	./tools/package.sh

# Optional: use the official helper when gnome-shell is installed. The plain
# `pack` target above works everywhere and produces the same zip layout.
pack-gnome: check
	@if ! command -v gnome-extensions >/dev/null 2>&1; then \
		echo "error: gnome-extensions is not installed" >&2; \
		exit 1; \
	fi
	mkdir -p "$(DIST)"
	gnome-extensions pack --force \
		--schema=schemas/$(SCHEMA).gschema.xml \
		--extra-source=lib \
		--extra-source=effects \
		--out-dir="$(DIST)"

release: check-release pack
	@echo
	@echo "Ready to upload: $(ZIP)"
	@echo "GNOME Extensions: https://extensions.gnome.org/upload/"

# Local helper (not tracked in git). Kept as a convenience target when the
# script is present in the working tree.
nested:
	@bash -c 'if [ -f nested-shell.sh ]; then ./nested-shell.sh; else echo "error: nested-shell.sh is not present (it is ignored by git)" >&2; exit 1; fi'

clean:
	rm -rf build dist schemas/gschemas.compiled
