const path = require("path");
const axios = require("axios");
const https = require("https");
const hardware = require("./hardware");
const integration = require("./integration");
const { app, nativeTheme, globalShortcut, ipcMain, session, BaseWindow, WebContentsView } = require("electron");

global.WEBVIEW = global.WEBVIEW || {
  initialized: false,
  tracker: {
    pointer: {
      position: {},
      time: new Date(),
    },
    display: {},
    status: null,
  },
};

/**
 * Initializes the webview with the provided arguments.
 *
 * @returns {bool} Returns true if the initialization was successful.
 */
const init = async () => {
  if (ARGS.web_url.length === 0) {
    console.error("Please provide the '--web-url' parameter");
    return app.quit();
  }
  if (ARGS.web_url.some((url) => !/^https?:\/\//.test(url))) {
    console.error("Please provide the '--web-url' parameter with http(s)");
    return app.quit();
  }
  session.defaultSession.clearCache();

  // Parse arguments
  const fullscreen = ARGS.app_debug !== "true";
  const widget = ARGS.web_widget ? ARGS.web_widget === "true" : true;
  const zoom = !isNaN(parseFloat(ARGS.web_zoom)) ? parseFloat(ARGS.web_zoom) : 1.25;
  const theme = ["light", "dark"].includes(ARGS.web_theme) ? ARGS.web_theme : "dark";
  const urls = [loaderHtml(40, 1.0, theme)].concat(ARGS.web_url);

  // Init global properties
  WEBVIEW.viewActive = 0;
  WEBVIEW.viewUrls = urls;
  WEBVIEW.viewZoom = zoom;
  WEBVIEW.viewTheme = theme;
  WEBVIEW.pagerEnabled = widget;
  WEBVIEW.widgetTheme = theme;
  WEBVIEW.widgetEnabled = widget;
  WEBVIEW.navigationTheme = theme;
  WEBVIEW.navigationEnabled = widget;
  nativeTheme.themeSource = WEBVIEW.viewTheme;

  // Init global root window
  WEBVIEW.window = new BaseWindow({
    title: APP.title,
    icon: path.join(APP.path, "img", "icon.png"),
    fullscreen: fullscreen,
    autoHideMenuBar: true,
    frame: true,
  });
  WEBVIEW.window.setMenuBarVisibility(false);

  // Init global webview
  WEBVIEW.views = [];
  urls.forEach((url, i) => {
    const view = new WebContentsView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    view.setVisible(i === 0);
    view.setBackgroundColor("#FFFFFFFF");
    WEBVIEW.window.contentView.addChildView(view);
    WEBVIEW.views.push(view);
    onlineStatus(url).then(() => {
      view.webContents.loadURL(url);
    });
  });

  // Init global pager
  WEBVIEW.pager = new WebContentsView({
    transparent: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  WEBVIEW.pager.setBackgroundColor("#00000000");
  WEBVIEW.window.contentView.addChildView(WEBVIEW.pager);
  WEBVIEW.pager.webContents.loadFile(path.join(APP.path, "html", "pager.html"));

  // Init global widget
  WEBVIEW.widget = new WebContentsView({
    transparent: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  WEBVIEW.widget.setBackgroundColor("#00000000");
  WEBVIEW.window.contentView.addChildView(WEBVIEW.widget);
  WEBVIEW.widget.webContents.loadFile(path.join(APP.path, "html", "widget.html"));

  // Init global navigation
  WEBVIEW.navigation = new WebContentsView({
    transparent: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  WEBVIEW.navigation.setBackgroundColor("#00000000");
  WEBVIEW.window.contentView.addChildView(WEBVIEW.navigation);
  WEBVIEW.navigation.webContents.loadFile(path.join(APP.path, "html", "navigation.html"));

  // Register local events
  await windowEvents();
  await widgetEvents();
  await navigationEvents();
  await viewEvents();
  await appEvents();

  // Register global events
  EVENTS.on("reloadView", reloadView);
  EVENTS.on("updateView", updateView);
  EVENTS.on("updateDisplay", () => {
    const status = hardware.getDisplayStatus();
    if (status) {
      WEBVIEW.tracker.display[status.toLowerCase()] = new Date();
    }
  });
  EVENTS.on("updateStatus", () => {
    const visibility = hardware.getKeyboardVisibility();
    if (visibility === "ON" && (WEBVIEW.window.isFullScreen() || WEBVIEW.window.isMinimized())) {
      hardware.setKeyboardVisibility("OFF");
    }
  });
  EVENTS.on("updateKeyboard", () => {
    const visibility = hardware.getKeyboardVisibility();
    if (visibility === "ON" && WEBVIEW.window.isFullScreen()) {
      WEBVIEW.window.setStatus("maximized");
    } else if (visibility === "OFF" && WEBVIEW.window.isMaximized()) {
      WEBVIEW.window.setStatus("fullscreen");
    }
  });

  return true;
};

/**
 * Updates the shared webview properties.
 */
const update = async () => {
  if (!WEBVIEW.initialized) {
    return;
  }

  // Update window status
  updateStatus();

  // Update widget status
  updateWidget();

  // Update navigation status
  updateNavigation();

  // Update integration sensor
  integration.update();
};

/**
 * Updates the active view.
 */
const updateView = () => {
  if (!WEBVIEW.viewActive) {
    return;
  }
  const url = WEBVIEW.views[WEBVIEW.viewActive].webContents.getURL();
  const host = url.startsWith("data:") ? "whoopsie" : new URL(url).host;
  const title = `${APP.title} - ${host} (${WEBVIEW.viewActive})`;

  // Update window title
  console.log(`Update View: ${title}`);
  WEBVIEW.window.setTitle(title);

  // Hide all other webviews and show only the active one
  WEBVIEW.views.forEach((view, i) => {
    view.setVisible(i === WEBVIEW.viewActive);
  });
  update();
};

/**
 * Updates the window status.
 */
const updateStatus = () => {
  if (WEBVIEW.window.isFullScreen()) {
    WEBVIEW.tracker.status = "Fullscreen";
  } else if (WEBVIEW.window.isMinimized()) {
    WEBVIEW.tracker.status = "Minimized";
  } else if (WEBVIEW.window.isMaximized()) {
    WEBVIEW.tracker.status = "Maximized";
  } else {
    WEBVIEW.tracker.status = "Framed";
  }

  // Update window status
  console.log("Update Kiosk Status:", WEBVIEW.tracker.status);
  EVENTS.emit("updateStatus");
};

/**
 * Updates the widget control.
 */
const updateWidget = () => {
  // Hide keyboard button
  WEBVIEW.widget.webContents.send("button-hidden", {
    id: "keyboard",
    hidden: !HARDWARE.support.keyboardVisibility,
  });

  // Hide navigation button
  WEBVIEW.widget.webContents.send("button-hidden", {
    id: "navigation",
    hidden: !WEBVIEW.navigationEnabled,
  });
};

/**
 * Updates the navigation control.
 */
const updateNavigation = () => {
  const view = WEBVIEW.views[WEBVIEW.viewActive];
  const defaultUrl = WEBVIEW.viewUrls[WEBVIEW.viewActive];
  const currentUrl = view.webContents.getURL();

  // Hide pager buttons
  WEBVIEW.navigation.webContents.send("button-hidden", {
    id: "previous",
    hidden: WEBVIEW.viewUrls.length <= 2,
  });
  WEBVIEW.navigation.webContents.send("button-hidden", {
    id: "next",
    hidden: WEBVIEW.viewUrls.length <= 2,
  });

  // Disable pager buttons
  WEBVIEW.navigation.webContents.send("button-disabled", {
    id: "previous",
    disabled: WEBVIEW.viewActive <= 1,
  });
  WEBVIEW.navigation.webContents.send("button-disabled", {
    id: "next",
    disabled: WEBVIEW.viewActive >= WEBVIEW.viewUrls.length - 1,
  });

  // Update url text
  WEBVIEW.navigation.webContents.send("input-text", {
    id: "url",
    text: currentUrl.startsWith("data:") ? "" : currentUrl,
    placeholder: defaultUrl.startsWith("data:") ? "" : defaultUrl,
  });
  WEBVIEW.navigation.webContents.send("input-readonly", {
    id: "url",
    readonly: !!HARDWARE.support.keyboardVisibility,
  });

  // Disable zoom buttons
  WEBVIEW.navigation.webContents.send("button-disabled", {
    id: "minus",
    disabled: view.webContents.getZoomFactor().toFixed(2) <= 0.25,
  });
  WEBVIEW.navigation.webContents.send("button-disabled", {
    id: "plus",
    disabled: view.webContents.getZoomFactor().toFixed(2) >= 4.0,
  });

  // Disable history buttons
  WEBVIEW.navigation.webContents.send("button-disabled", {
    id: "backward",
    disabled: !view.webContents.navigationHistory.canGoBack(),
  });
  WEBVIEW.navigation.webContents.send("button-disabled", {
    id: "forward",
    disabled: !view.webContents.navigationHistory.canGoForward(),
  });
};

/**
 * Shows or hides the webview navigation bar.
 */
const toggleNavigation = () => {
  const window = WEBVIEW.window.getBounds();
  const navigation = WEBVIEW.navigation.getBounds();
  const height = navigation.height > 0 ? 0 : 60;

  // Show or hide navigation based on height
  WEBVIEW.navigation.setBounds({
    x: 0,
    y: window.height - height,
    width: window.width,
    height: height,
  });
  if (height > 0) {
    WEBVIEW.navigation.webContents.focus();
  } else {
    WEBVIEW.views[WEBVIEW.viewActive].webContents.focus();
  }

  // Resize webview
  resizeView();
};

/**
 * Decreases page zoom on the active webview.
 */
const zoomMinus = () => {
  const view = WEBVIEW.views[WEBVIEW.viewActive];
  view.webContents.setZoomFactor(Math.max(0.25, view.webContents.getZoomFactor() - 0.1));
  update();
};

/**
 * Increases page zoom on the active webview.
 */
const zoomPlus = () => {
  const view = WEBVIEW.views[WEBVIEW.viewActive];
  view.webContents.setZoomFactor(Math.min(4.0, view.webContents.getZoomFactor() + 0.1));
  update();
};

/**
 * Navigates backward in the history of the active webview.
 */
const historyBackward = () => {
  const view = WEBVIEW.views[WEBVIEW.viewActive];
  if (view.webContents.navigationHistory.canGoBack()) {
    view.webContents.navigationHistory.goBack();
  }
};

/**
 * Navigates forward in the history of the active webview.
 */
const historyForward = () => {
  const view = WEBVIEW.views[WEBVIEW.viewActive];
  if (view.webContents.navigationHistory.canGoForward()) {
    view.webContents.navigationHistory.goForward();
  }
};

/**
 * Activates the previous webview page.
 */
const previousView = () => {
  if (WEBVIEW.viewActive > 1) WEBVIEW.viewActive--;
  updateView();
};

/**
 * Activates the next webview page.
 */
const nextView = () => {
  if (WEBVIEW.viewActive < WEBVIEW.views.length - 1) WEBVIEW.viewActive++;
  updateView();
};

/**
 * Reloads the default url and settings on the active webview.
 */
const homeView = () => {
  const view = WEBVIEW.views[WEBVIEW.viewActive];
  const defaultUrl = WEBVIEW.viewUrls[WEBVIEW.viewActive];
  const currentUrl = view.webContents.getURL();

  // Reload the default url or refresh the page
  if (currentUrl != defaultUrl) {
    view.webContents.loadURL(defaultUrl);
  } else {
    view.webContents.reloadIgnoringCache();
  }

  // Reset page zoom and history
  view.webContents.setZoomFactor(WEBVIEW.viewZoom);
  setTimeout(() => {
    view.webContents.navigationHistory.clear();
    update();
  }, 2000);
};

/**
 * Reloads the current url on the active webview.
 */
const reloadView = () => {
  const view = WEBVIEW.views[WEBVIEW.viewActive];
  const defaultUrl = WEBVIEW.viewUrls[WEBVIEW.viewActive];
  const currentUrl = view.webContents.getURL();

  // Reload the default url or refresh the page
  if (currentUrl.startsWith("data:")) {
    view.webContents.loadURL(defaultUrl);
  } else {
    view.webContents.reloadIgnoringCache();
  }
  update();
};

/**
 * Resizes and positions all webviews.
 */
const resizeView = () => {
  const window = WEBVIEW.window.getBounds();
  const navigation = WEBVIEW.navigation.getBounds();
  const pager = { width: 20, height: window.height };
  const widget = { width: 60, height: 200 };

  // Update view size
  WEBVIEW.views.forEach((view) => {
    view.setBounds({
      x: 0,
      y: 0,
      width: window.width,
      height: window.height - navigation.height,
    });
  });

  // Update pager size
  if (WEBVIEW.pagerEnabled) {
    WEBVIEW.pager.setBounds({
      x: window.width - pager.width,
      y: 0,
      width: pager.width,
      height: pager.height,
    });
    WEBVIEW.pager.webContents.send("data-theme", { theme: "hidden" });
  }

  // Update widget size
  if (WEBVIEW.widgetEnabled) {
    WEBVIEW.widget.setBounds({
      x: window.width - 20,
      y: parseInt(window.height / 2 - widget.height / 2, 10),
      width: widget.width,
      height: widget.height,
    });
    WEBVIEW.widget.webContents.send("data-theme", { theme: "hidden" });
  }

  // Update navigation size
  if (WEBVIEW.navigationEnabled) {
    WEBVIEW.navigation.setBounds({
      x: 0,
      y: window.height - navigation.height,
      width: window.width,
      height: navigation.height,
    });
    WEBVIEW.navigation.webContents.send("data-theme", { theme: WEBVIEW.navigationTheme });
  }
};

/**
 * Register window events and handler.
 */
const windowEvents = async () => {
  // Handle window resize events
  WEBVIEW.window.on("ready-to-show", resizeView);
  WEBVIEW.window.on("resize", resizeView);
  resizeView();

  // Handle window status updates
  WEBVIEW.window.setStatus = async (status) => {
    const apply = (f, ...args) => {
      f.apply(WEBVIEW.window, args);
      return new Promise((r) => setTimeout(r, 50));
    };
    if (WEBVIEW.window.isMinimized()) {
      await apply(WEBVIEW.window.restore);
    }
    switch (status.toLowerCase()) {
      case "framed":
        if (WEBVIEW.window.isFullScreen()) {
          await apply(WEBVIEW.window.setFullScreen, false);
        }
        if (WEBVIEW.window.isMaximized()) {
          await apply(WEBVIEW.window.unmaximize);
        }
        break;
      case "fullscreen":
        if (!WEBVIEW.window.isMaximized()) {
          await apply(WEBVIEW.window.maximize);
        }
        if (!WEBVIEW.window.isFullScreen()) {
          await apply(WEBVIEW.window.setFullScreen, true);
        }
        break;
      case "maximized":
        if (WEBVIEW.window.isFullScreen()) {
          await apply(WEBVIEW.window.setFullScreen, false);
        }
        if (!WEBVIEW.window.isMaximized()) {
          await apply(WEBVIEW.window.maximize);
        }
        break;
      case "minimized":
        if (WEBVIEW.window.isFullScreen()) {
          await apply(WEBVIEW.window.setFullScreen, false);
        }
        if (!WEBVIEW.window.isMinimized()) {
          await apply(WEBVIEW.window.minimize);
        }
        break;
      case "terminated":
        app.quit();
    }
  };
  WEBVIEW.window.onStatus = () => {
    clearTimeout(WEBVIEW.window.onStatus.timeout);
    WEBVIEW.window.onStatus.timeout = setTimeout(update, 200);
  };
  WEBVIEW.window.on("restore", WEBVIEW.window.onStatus);
  WEBVIEW.window.on("minimize", WEBVIEW.window.onStatus);
  WEBVIEW.window.on("maximize", WEBVIEW.window.onStatus);
  WEBVIEW.window.on("unmaximize", WEBVIEW.window.onStatus);
  WEBVIEW.window.on("enter-full-screen", WEBVIEW.window.onStatus);
  WEBVIEW.window.on("leave-full-screen", WEBVIEW.window.onStatus);

  // Handle global shortcut events
  globalShortcut.register("Control+Left", () => {
    previousView();
  });
  globalShortcut.register("Control+Right", () => {
    nextView();
  });
  globalShortcut.register("Control+numsub", () => {
    zoomMinus();
  });
  globalShortcut.register("Control+numadd", () => {
    zoomPlus();
  });
  globalShortcut.register("Alt+Left", () => {
    historyBackward();
  });
  globalShortcut.register("Alt+Right", () => {
    historyForward();
  });

  // Check for window touch events (1s)
  setInterval(() => {
    const now = new Date();
    const then = WEBVIEW.tracker.pointer.time;
    const delta = (now - then) / 1000;

    // Auto-hide navigation
    if (delta > 60) {
      const navigation = WEBVIEW.navigation.getBounds();
      if (navigation.height > 0) {
        toggleNavigation();
      }
    }
  }, 1000);
};

/**
 * Register widget events and handler.
 */
const widgetEvents = async () => {
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
      x: window.width - 20,
      y: widget.y,
      width: widget.width,
      height: widget.height,
    });
    WEBVIEW.widget.webContents.send("data-theme", { theme: "hidden" });
  });

  // Handle widget button click events
  ipcMain.on("button-click", (e, button) => {
    switch (button.id) {
      case "keyboard":
        const toggle = hardware.getKeyboardVisibility() === "ON" ? "OFF" : "ON";
        hardware.setKeyboardVisibility(toggle, () => {
          WEBVIEW.views[WEBVIEW.viewActive].webContents.focus();
        });
        break;
      case "fullscreen":
        if (WEBVIEW.window.isFullScreen()) {
          WEBVIEW.window.setStatus("framed");
        } else {
          WEBVIEW.window.setStatus("fullscreen");
        }
        WEBVIEW.views[WEBVIEW.viewActive].webContents.focus();
        break;
      case "minimize":
        WEBVIEW.window.setStatus("minimized");
        break;
      case "navigation":
        toggleNavigation();
        break;
    }
  });
};

/**
 * Register navigation events and handler.
 */
const navigationEvents = async () => {
  if (!WEBVIEW.navigationEnabled) {
    return;
  }

  // Handle input blur events
  let selected = false;
  ipcMain.on("input-blur", (e, input) => {
    const visibility = hardware.getKeyboardVisibility();
    switch (input.id) {
      case "url":
        if (visibility === "ON" && selected) {
          hardware.setKeyboardVisibility("OFF", () => {
            WEBVIEW.navigation.webContents.send("input-select", { id: "url", select: false });
            WEBVIEW.navigation.webContents.send("input-readonly", { id: "url", readonly: true });
          });
        }
        break;
    }
  });

  // Handle input focus events
  ipcMain.on("input-focus", (e, input) => {
    const visibility = hardware.getKeyboardVisibility();
    switch (input.id) {
      case "url":
        if (visibility === "OFF") {
          selected = false;
          hardware.setKeyboardVisibility("ON", () => {
            setTimeout(() => {
              selected = true;
              WEBVIEW.navigation.webContents.focus();
              WEBVIEW.navigation.webContents.send("input-select", { id: "url", select: true });
              WEBVIEW.navigation.webContents.send("input-readonly", { id: "url", readonly: false });
            }, 400);
          });
        }
        break;
    }
  });

  // Handle input enter events
  ipcMain.on("input-enter", (e, input) => {
    switch (input.id) {
      case "url":
        let url = input.text.trim();
        if (url && !/^[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(url)) {
          url = "https://" + url;
        }
        if (!url) {
          url = WEBVIEW.viewUrls[WEBVIEW.viewActive];
        }
        WEBVIEW.views[WEBVIEW.viewActive].webContents.loadURL(url);
        break;
    }
  });

  // Handle navigation button click events
  ipcMain.on("button-click", (e, button) => {
    const view = WEBVIEW.views[WEBVIEW.viewActive];
    switch (button.id) {
      case "home":
        homeView();
        break;
      case "refresh":
        reloadView();
        break;
      case "previous":
        previousView();
        break;
      case "next":
        nextView();
        break;
      case "minus":
        zoomMinus();
        break;
      case "plus":
        zoomPlus();
        break;
      case "backward":
        historyBackward();
        break;
      case "forward":
        historyForward();
        break;
    }
  });
};

/**
 * Register view events and handler.
 */
const viewEvents = async () => {
  const ready = [];
  WEBVIEW.views.forEach((view, i) => {
    // Enable webview touch emulation
    view.webContents.debugger.attach("1.1");
    view.webContents.debugger.sendCommand("Emulation.setEmitTouchEventsForMouse", {
      configuration: "mobile",
      enabled: true,
    });

    // Redirect webview hyperlinks
    view.webContents.setWindowOpenHandler(({ url }) => {
      view.webContents.loadURL(url);
      return { action: "deny" };
    });

    // Update webview layout
    view.webContents.on("dom-ready", () => {
      view.webContents.insertCSS("::-webkit-scrollbar { display: none; }");
      if (ready.length < WEBVIEW.views.length) {
        view.webContents.setZoomFactor(WEBVIEW.viewZoom);
        ready.push(i);
      }
    });

    // Webview fully loaded
    view.webContents.on("did-finish-load", () => {
      if (WEBVIEW.viewActive === 0 && ready.length === WEBVIEW.views.length) {
        nextView();
      }
      if (ARGS.app_debug === "true") {
        setTimeout(() => {
          view.webContents.openDevTools();
        }, 2000);
      }
    });

    // Webview not loaded
    view.webContents.on("did-fail-load", (e, code, text, url, mainframe) => {
      if (mainframe) {
        if (WEBVIEW.viewActive === 0 && ready.length === WEBVIEW.views.length) {
          nextView();
        }
        view.webContents.loadURL(errorHtml(code, text, url));
      }
    });

    // Webview url changed
    view.webContents.on("did-navigate-in-page", (e, url, mainframe) => {
      if (mainframe) {
        updateView();
      }
    });
    view.webContents.on("did-navigate", () => {
      updateView();
    });

    // Handle webview mouse events
    view.webContents.on("before-mouse-event", (e, mouse) => {
      const now = new Date();
      const then = WEBVIEW.tracker.pointer.time;
      const delta = (now - then) / 1000;
      switch (mouse.type) {
        case "mouseMove":
          const posNew = { x: mouse.globalX, y: mouse.globalY };
          if (posNew.x < 0 || posNew.y < 0) {
            break;
          }
          // Update last active on pointer position change
          const posOld = WEBVIEW.tracker.pointer.position;
          if (posOld.x !== posNew.x || posOld.y !== posNew.y) {
            WEBVIEW.tracker.pointer.time = now;
            WEBVIEW.tracker.pointer.position = posNew;
            if (delta > 30) {
              console.log("Update Last Active");
              integration.update();
            }
          }
          break;
        case "mouseDown":
          switch (mouse.button) {
            case "left":
              // Ignore touch event if display was off
              if (WEBVIEW.tracker.display.off > WEBVIEW.tracker.display.on) {
                console.log("Display Touch Event: Ignored");
                e.preventDefault();
              }
              // Turn display on if it was off
              if (hardware.getDisplayStatus() === "OFF") {
                hardware.setDisplayStatus("ON");
              }
              break;
            case "back":
              historyBackward();
              break;
            case "forward":
              historyForward();
              break;
          }
          break;
      }
    });
  });
};

/**
 * Register app events and handler.
 */
const appEvents = async () => {
  // Handle multiple instances
  app.on("second-instance", () => {
    if (WEBVIEW.window.isMinimized()) {
      WEBVIEW.window.restore();
    }
    WEBVIEW.window.focus();
  });

  // Handle signal and exit events
  app.on("before-quit", () => {
    WEBVIEW.tracker.status = "Terminated";
    console.warn(`${APP.title} Terminated`);
    integration.update();
  });
  process.on("SIGINT", app.quit);

  // Webview initialized
  WEBVIEW.initialized = true;

  // Check for latest release infos (2h)
  setInterval(() => {
    latestRelease();
  }, 7200 * 1000);
  await latestRelease();
};

/**
 * Fetches the latest app release infos from github.
 */
const latestRelease = async () => {
  try {
    const response = await axios.get(`${APP.releases.url}/latest`, { timeout: 10000 });
    const data = response ? response.data : null;
    if (!data || data.draft || data.prerelease) {
      return;
    }
    APP.releases.latest = {
      title: APP.title,
      version: (data.tag_name || data.name || " ").replace(/^v/i, ""),
      summary: data.body || " ",
      url: data.html_url || " ",
    };
  } catch (error) {
    console.warn("Github Error:", error.message);
  }
};

/**
 * Checks for network connectivity by requesting a known url.
 *
 * @param {string} url - Url to request.
 * @param {number} interval - Interval between requests in milliseconds.
 * @param {number} timeout - Maximum time to repeat requests in milliseconds.
 * @returns {Promise<boolean>} Resolves true if online, false on timeout.
 */
const onlineStatus = (url, interval = 1000, timeout = 60000) => {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = async () => {
      const elapsed = Date.now() - start;
      try {
        if (!url.startsWith("data:")) {
          const agent = new https.Agent({ rejectUnauthorized: !("ignore_certificate_errors" in ARGS) });
          await axios.get(url, { httpsAgent: agent, timeout: 10000 });
        }
        resolve(true);
      } catch (error) {
        if (elapsed >= interval) {
          console.warn(`Checking Connection: ${url}`, error.message);
        }
        if (elapsed >= timeout) {
          if (error.message?.includes("certificate")) {
            console.error("Certificate Error: See https://github.com/leukipp/touchkio/issues/76");
          }
          resolve(false);
        } else {
          setTimeout(check, interval);
        }
      }
    };
    check();
  });
};

/**
 * Generates a html template for a spinning loader.
 *
 * @param {number} size - The size of the circle.
 * @param {number} speed - The rotation speed of the circle.
 * @param {string} theme - The theme used for spinner colors.
 * @returns {string} A data string with the generated html.
 */
const loaderHtml = (size, speed, theme) => {
  const color = {
    dark: { border: "#2A2A2A", spinner: "#03A9F4", background: "#111111" },
    light: { border: "#DCDCDC", spinner: "#03A9F4", background: "#FAFAFA" },
  }[theme];
  const html = `
    <html>
      <head>
        <style>
          body {
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: ${color.background};
          }
          .spinner {
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            border: 4px solid ${color.border};
            border-top-color: ${color.spinner};
            animation: spin ${speed}s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="spinner"></div>
      </body>
    </html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
};

/**
 * Generates a html template for an error page.
 *
 * @param {number} code - The error code of the response.
 * @param {string} text - The error text of the response.
 * @param {string} url - The url of the requested page.
 * @returns {string} A data string with the generated html.
 */
const errorHtml = (code, text, url) => {
  const html = `
    <html>
      <head>
        <style>
          body {
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: sans-serif;
            text-align: center;
          }
          .icon {
            margin: 0;
            font-size: 5rem;
            color: orange;
          }
          .title {
            margin: 0;
          }
        </style>
      </head>
      <body>
        <div>
          <p class="icon">&#9888;</p>
          <h1 class="title">Whoopsie!</h1>
          <p><strong>Loading:</strong> ${url}</p>
          <p><strong>Error:</strong> ${text} (${code})</p>
        </div>
      </body>
    </html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
};

module.exports = {
  init,
  update,
};
