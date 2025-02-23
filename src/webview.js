const path = require("path");
const hardware = require("./hardware");
const integration = require("./integration");
const { app, screen, nativeTheme, ipcMain, BaseWindow, WebContentsView } = require("electron");

global.WEBVIEW = global.WEBVIEW || {
  initialized: false,
  status: "offline",
  locked: false,
  pointer: {
    position: {},
    time: new Date(),
  },
};

/**
 * Initializes the webview with the provided arguments.
 *
 * @returns {boolean} Returns true if the initialization was successful.
 */
const init = async () => {
  if (!ARGS.web_url) {
    console.error("Please provide the '--web-url' parameter");
    return app.quit();
  }
  if (!/^https?:\/\//.test(ARGS.web_url)) {
    console.error("Please provide the '--web-url' parameter with http(s)");
    return app.quit();
  }
  const url = new URL(ARGS.web_url);
  const theme = ["light", "dark"].includes(ARGS.web_theme) ? ARGS.web_theme : "dark";
  const zoom = !isNaN(parseFloat(ARGS.web_zoom)) ? parseFloat(ARGS.web_zoom) : 1.25;
  const widget = ARGS.web_widget ? ARGS.web_widget === "true" : true;
  const fullscreen = ARGS.app_debug !== "true";

  // Init global layout
  WEBVIEW.viewZoom = zoom;
  WEBVIEW.viewTheme = theme;
  WEBVIEW.widgetTheme = theme;
  WEBVIEW.widgetEnabled = widget;
  nativeTheme.themeSource = WEBVIEW.viewTheme;

  // Init global root window
  WEBVIEW.window = new BaseWindow({
    title: `TouchKio - ${url.host}`,
    icon: path.join(__dirname, "..", "img", "icon.png"),
  });
  WEBVIEW.window.setMenuBarVisibility(false);
  WEBVIEW.window.setFullScreen(fullscreen);
  if (!fullscreen) {
    WEBVIEW.window.maximize();
  }

  // Init global webview
  WEBVIEW.view = new WebContentsView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  WEBVIEW.window.contentView.addChildView(WEBVIEW.view);
  WEBVIEW.view.webContents.loadURL(url.toString());
  WEBVIEW.view.setBackgroundColor("#FFFFFFFF");

  // Init global widget
  WEBVIEW.widget = new WebContentsView({
    transparent: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  WEBVIEW.window.contentView.addChildView(WEBVIEW.widget);
  WEBVIEW.widget.webContents.loadFile(path.join(__dirname, "widget.html"));
  WEBVIEW.widget.setBackgroundColor("#00000000");

  // Register events
  windowEvents();
  widgetEvents();
  domEvents();
  appEvents();

  return true;
};

/**
 * Updates the shared webview properties.
 */
const update = () => {
  if (!WEBVIEW.initialized) {
    return;
  }

  // Update window status
  if (WEBVIEW.window.isFullScreen()) {
    WEBVIEW.status = "Fullscreen";
  } else if (WEBVIEW.window.isMinimized()) {
    WEBVIEW.status = "Minimized";
  } else if (WEBVIEW.window.isMaximized()) {
    WEBVIEW.status = "Maximized";
  } else {
    WEBVIEW.status = "Framed";
  }

  // Update widget status
  if (!HARDWARE.support.keyboardVisibility) {
    WEBVIEW.widget.webContents.send("button-hide", { id: "keyboard" });
  }

  // Update integration sensor
  console.log("Update Kiosk Status:", WEBVIEW.status);
  integration.update();
};

/**
 * Register window events and handler.
 */
const windowEvents = () => {
  // Handle window resize events
  const resize = () => {
    const window = WEBVIEW.window.getBounds();
    const widget = { width: 60, height: 200 };

    // Update view size
    WEBVIEW.view.setBounds({
      x: 0,
      y: 0,
      width: window.width,
      height: window.height,
    });
    WEBVIEW.view.webContents.setZoomFactor(WEBVIEW.viewZoom);
    WEBVIEW.view.webContents.focus();

    // Update widget size
    if (WEBVIEW.widgetEnabled) {
      WEBVIEW.widget.setBounds({
        x: window.width - 15,
        y: parseInt(window.height / 2 - widget.height / 2),
        width: widget.width,
        height: widget.height,
      });
      WEBVIEW.widget.webContents.send("data-theme", { theme: "hidden" });
    }
  };
  WEBVIEW.window.on("ready-to-show", resize);
  WEBVIEW.window.on("resize", resize);
  resize();

  // Handle window focus events
  WEBVIEW.window.on("focus", () => {
    if (WEBVIEW.locked) {
      hardware.setDisplayStatus("ON");
      WEBVIEW.window.blur();
    }
    WEBVIEW.locked = false;
  });
  HARDWARE.display.notifiers.push(() => {
    WEBVIEW.locked = hardware.getDisplayStatus() === "OFF";
    if (WEBVIEW.locked) {
      WEBVIEW.window.blur();
    }
  });

  // Handle window status updates
  WEBVIEW.window.on("minimize", update);
  WEBVIEW.window.on("restore", update);
  WEBVIEW.window.on("maximize", update);
  WEBVIEW.window.on("unmaximize", update);
  WEBVIEW.window.on("enter-full-screen", update);
  WEBVIEW.window.on("leave-full-screen", update);

  // Handle window touch events for activity tracking
  setInterval(() => {
    const posOld = WEBVIEW.pointer.position;
    const posNew = screen.getCursorScreenPoint();
    if (posOld.x !== posNew.x || posOld.y !== posNew.y) {
      const now = new Date();
      const then = WEBVIEW.pointer.time;

      // Update integration sensor
      WEBVIEW.pointer.time = now;
      if (Math.abs(now - then) / 1000 > 30) {
        console.log("Update Last Active");
        integration.update();
      }
    }
    WEBVIEW.pointer.position = posNew;
  }, 1 * 1000);
};

/**
 * Register widget events and handler.
 */
const widgetEvents = () => {
  if (!WEBVIEW.widgetEnabled) {
    return;
  }

  // Handle widget focus events
  WEBVIEW.widget.webContents.on("focus", () => {
    const window = WEBVIEW.window.getBounds();
    const widget = WEBVIEW.widget.getBounds();

    // Show widget
    WEBVIEW.widget.setBounds({
      x: window.width - 60,
      y: widget.y,
      width: widget.width,
      height: widget.height,
    });
    WEBVIEW.widget.webContents.send("data-theme", { theme: WEBVIEW.widgetTheme });
  });

  // Handle widget blur events
  WEBVIEW.widget.webContents.on("blur", () => {
    const window = WEBVIEW.window.getBounds();
    const widget = WEBVIEW.widget.getBounds();

    // Hide widget
    WEBVIEW.widget.setBounds({
      x: window.width - 15,
      y: widget.y,
      width: widget.width,
      height: widget.height,
    });
    WEBVIEW.widget.webContents.send("data-theme", { theme: "hidden" });
  });

  // Handle widget button click events
  ipcMain.on("button-click", (e, button) => {
    switch (button.id) {
      case "refresh":
        WEBVIEW.view.webContents.reloadIgnoringCache();
        break;
      case "fullscreen":
        if (WEBVIEW.window.isFullScreen()) {
          WEBVIEW.window.restore();
          WEBVIEW.window.unmaximize();
          WEBVIEW.window.setFullScreen(false);
        } else {
          WEBVIEW.window.restore();
          WEBVIEW.window.unmaximize();
          WEBVIEW.window.setFullScreen(true);
        }
        break;
      case "minimize":
        WEBVIEW.window.restore();
        WEBVIEW.window.setFullScreen(false);
        WEBVIEW.window.minimize();
        break;
      case "keyboard":
        const toggle = hardware.getKeyboardVisibility() === "ON" ? "OFF" : "ON";
        hardware.setKeyboardVisibility(toggle);
        switch (toggle) {
          case "OFF":
            WEBVIEW.window.restore();
            WEBVIEW.window.unmaximize();
            WEBVIEW.window.setFullScreen(true);
            break;
          case "ON":
            WEBVIEW.window.restore();
            WEBVIEW.window.setFullScreen(false);
            WEBVIEW.window.maximize();
            break;
        }
        break;
    }
  });
};

/**
 * Register dom events and handler.
 */
const domEvents = () => {
  // Enable webview touch emulation
  WEBVIEW.view.webContents.debugger.attach("1.1");
  WEBVIEW.view.webContents.debugger.sendCommand("Emulation.setEmitTouchEventsForMouse", {
    configuration: "mobile",
    enabled: true,
  });

  // Disable webview hyperlinks
  WEBVIEW.view.webContents.setWindowOpenHandler(() => {
    return { action: "deny" };
  });

  // Remove webview scrollbar
  WEBVIEW.view.webContents.on("dom-ready", () => {
    WEBVIEW.view.webContents.insertCSS("::-webkit-scrollbar { display: none; }");
  });

  // Webview fully loaded
  WEBVIEW.view.webContents.on("did-finish-load", () => {
    if (ARGS.app_debug === "true") {
      WEBVIEW.view.webContents.openDevTools();
    }
    WEBVIEW.initialized = true;
    update();
  });
};

/**
 * Register app events and handler.
 */
const appEvents = () => {
  // Handle signal and exit events
  process.on("SIGINT", app.quit);
  app.on("before-quit", () => {
    WEBVIEW.status = "Terminated";
    integration.update();
  });

  // Handle multiple instances
  app.on("second-instance", () => {
    if (WEBVIEW.window.isMinimized()) {
      WEBVIEW.window.restore();
    }
    WEBVIEW.window.focus();
  });
};

module.exports = {
  init,
  update,
};
