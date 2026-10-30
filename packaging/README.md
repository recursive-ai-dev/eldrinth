# Debian desktop release

ELDRINTH includes its Electron runtime and all game assets. It plays offline
and does not need Node, a browser, a server or an account on the player's machine.

Install the package with APT so its system libraries are installed too:

```bash
sudo apt install ./eldrinth_1.3.0_amd64.deb
eldrinth
```

It also appears in the desktop Games menu. F11 toggles fullscreen; Alt reveals
the application menu. Gameplay controls are listed in the pause screen.
Version 1.3, **The Wayfarer’s Kit**, includes a discovery atlas, illustrated
field guide, lantern investigations, regional warden attacks, remappable keys,
and gamepad exploration/combat controls. Controls, volume, display, and comfort
preferences are available in the pause menu. Menus and dialogue choices use
keyboard or mouse.

The title screen exports individual pilgrimages as JSON and imports them into
empty slots. This transfers progress between browser and desktop and provides
an external backup without copying the entire desktop profile. Imports never
replace occupied slots. Keep exported files private if your journal contains
personal notes.

Window position, size, maximized and fullscreen settings are restored on launch.
A renderer crash offers a native reload prompt to return to the last checkpoint.
Run `man 6 eldrinth` for an offline command and controls reference.

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

On Ubuntu hosts that restrict unprivileged user namespaces, an extracted package
may not launch even though the installed package does. If the same Electron
sandbox helper is already installed with root ownership and mode 4755, test it
without changing system files or disabling the sandbox:

```bash
ELDRINTH_DESKTOP_SANDBOX_HELPER=/usr/lib/eldrinth/chrome-sandbox npm run test:desktop
```

The harness verifies the helper's owner, permissions, and exact bytes before
using it for the extracted package. It never alters the installed helper.
