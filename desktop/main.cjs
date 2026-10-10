const { app, BrowserWindow, Menu, protocol, session, dialog } = require("electron");
const { readFile } = require("node:fs/promises");
const { mkdirSync } = require("node:fs");
const { join } = require("node:path");
const { SCHEME, GAME_URL, CONTENT_SECURITY_POLICY, resolveAssetPath, isGameURL, mimeType } = require("./protocol.cjs");

app.setName("ELDRINTH");
app.setDesktopName("eldrinth.desktop");
app.setPath("userData", process.env.ELDRINTH_USER_DATA_DIR || join(app.getPath("appData"), "eldrinth"));
mkdirSync(app.getPath("userData"), { recursive: true });
app.enableSandbox();
protocol.registerSchemesAsPrivileged([{
  scheme: SCHEME,
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
}]);

let window;
let closing = false;
let allowClose = false;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  });

  app.whenReady().then(async () => {
    const dist = join(app.getAppPath(), "dist");
    protocol.handle(SCHEME, async request => {
      const file = resolveAssetPath(request.url, dist);
      if (!file) return new Response("Forbidden", { status: 403 });
      if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
      try {
        let body = await readFile(file);
        // Fonts are optional on the web. The desktop release uses local fonts
        // and does not contact a font service, even on first launch.
        if (file.endsWith("/index.html")) {
          body = Buffer.from(body.toString().replace(/<link\b[^>]*https:\/\/fonts\.(?:googleapis|gstatic)\.com[^>]*>/gi, ""));
        }
        return new Response(request.method === "HEAD" ? null : body, { headers: {
          "content-type": mimeType(file),
          "content-security-policy": CONTENT_SECURITY_POLICY,
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        } });
      } catch {
        return new Response("Not found", { status: 404 });
      }
    });
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.webRequest.onBeforeRequest({ urls: ["http://*/*", "https://*/*"] }, (_details, callback) => callback({ cancel: true }));

    window = new BrowserWindow({
      title: "ELDRINTH — The Unbound Spire",
      width: 1280,
      height: 800,
      minWidth: 640,
      minHeight: 360,
      backgroundColor: "#04050a",
      icon: join(__dirname, "icon.png"),
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        devTools: !app.isPackaged,
      },
    });
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    window.webContents.on("will-navigate", (event, url) => { if (!isGameURL(url)) event.preventDefault(); });
    window.webContents.on("will-attach-webview", event => event.preventDefault());
    window.once("ready-to-show", () => window.show());
    Menu.setApplicationMenu(Menu.buildFromTemplate([{
      label: "Game",
      submenu: [{ role: "togglefullscreen", accelerator: "F11" }, { type: "separator" }, { role: "quit" }],
    }]));

    window.on("close", async event => {
      if (allowClose) return;
      event.preventDefault();
      if (closing) return;
      closing = true;
      try {
        if (!window.webContents.isDestroyed() && isGameURL(window.webContents.getURL())) {
          await window.webContents.executeJavaScript("window.eldrinthCheckpoint?.()");
        }
        allowClose = true;
      } catch (error) {
        const choice = await dialog.showMessageBox(window, {
          type: "warning",
          title: "Progress could not be saved",
          message: "Your latest progress could not be saved.",
          detail: `${error.message}\nYour previous save is untouched.`,
          buttons: ["Keep playing", "Quit without saving"],
          defaultId: 0,
          cancelId: 0,
        });
        allowClose = choice.response === 1;
      } finally {
        closing = false;
        if (allowClose && !window.isDestroyed()) window.close();
      }
    });

    await window.loadURL(GAME_URL);
  }).catch(error => {
    console.error("Desktop startup failed:", error);
    dialog.showErrorBox("ELDRINTH could not start", error.message);
    app.exit(1);
  });
}

app.on("window-all-closed", () => app.quit());
