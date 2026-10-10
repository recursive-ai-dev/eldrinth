# Debian desktop release

ELDRINTH includes its Electron runtime and all game assets. It plays offline
and does not need Node, a browser, a server or an account on the player's machine.

Install the package with APT so its system libraries are installed too:

```bash
sudo apt install ./eldrinth_1.2.0_amd64.deb
eldrinth
```

It also appears in the desktop Games menu. F11 toggles fullscreen; Alt reveals
the application menu. Gameplay controls are listed in the pause screen.
Version 1.2, **Names in the Fire**, adds named vessel decisions, memories beside
wayfires, the Last Breath parry (`F`), and an offline procedural soundscape.
Volume and mute preferences are available in the pause menu.

The desktop app stores saves under `$XDG_CONFIG_HOME/eldrinth`, or
`~/.config/eldrinth` when XDG_CONFIG_HOME is unset. Package upgrades and removal
leave this directory intact. Browser saves use a different origin and are
separate from desktop saves. Close the game before backing up this directory.
On a normal close the game waits for a final save. If saving fails, you can
keep playing or explicitly quit without saving the latest progress.

To upgrade, close ELDRINTH and install the new `.deb` with the same APT command.
There is no need to remove the previous package. Existing slots and their
progress remain available. For an additional backup, copy the entire save
directory while the game is closed; restore it only while the game is closed.
Release notes are included in `/usr/share/doc/eldrinth/CHANGELOG.md`.

The launcher detects Wayland sessions without XWayland and selects Electron's
Wayland platform automatically. Sessions with an X display retain Electron's
default platform selection.

The package retains Chromium's sandbox. Its `chrome-sandbox` helper is
owned by root with mode 4755 when installed by dpkg. Run the game as your
normal desktop user.

## Build and verify

Use Node 24 LTS and npm on Linux, with `dpkg-deb` available (`dpkg` package).
The build packages the host's native Electron runtime. The release tested here
is amd64. The runtime download is pinned by the lockfile and verified by the
Electron installer's checksums.

```bash
npm ci
npm test
npm run test:desktop:unit
npm run build:deb
npm run verify:deb
npm run test:browser   # requires Playwright Chromium
npm run test:desktop   # checks the extracted package; requires a display
```

`release/` contains the `.deb`, its SHA-256 checksum and JSON release metadata.
Build output is ignored by Git; `dist/` remains committed. Set SOURCE_DATE_EPOCH
to a fixed Unix timestamp to reproduce archive timestamps. Without it, the
build uses the latest commit's timestamp. `ELDRINTH_USER_DATA_DIR` can select
an isolated profile for desktop testing or a portable backup.

On CI, `xvfb-run -a npm run test:desktop` supplies a virtual display. The
desktop smoke test uses temporary save data and runs from the contents of the
actual `.deb`. Set ELDRINTH_DESKTOP_EXECUTABLE to an installed binary to test
its installed sandbox helper as well. Extracted-package tests use the kernel's
namespace sandbox because an extracted helper cannot be owned by root. CI
installs the package and tests its normal sandbox configuration.
