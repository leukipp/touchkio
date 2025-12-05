const path = require("path");
const axios = require("axios");
const https = require("https");
const hardware = require("./hardware");
const integration = require("./integration");
const {
  app,
  nativeTheme,
  globalShortcut,
  ipcMain,
  dialog,
  screen,
  session,
  BaseWindow,
  WebContentsView,
} = require("electron");

global.WEBVIEW = global.WEBVIEW || {
  initialized: false,
  tracker: {
    display: {
      on: new Date(0),
      off: new Date(0),
      lastWakeup: null,
    },
    pointer: {
      position: {},
      time: new Date(),
    },
    motion: {
      detected: false,
      clearTimer: null,
    },
    window: {
      status: null,
    },
    widget: {
      focused: null,
    },
    screenshot: null,
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

  // Clear cache and storage
  await session.defaultSession.clearCache();
  if (ARGS.app_reset === "storage") {
    await session.defaultSession.clearStorageData();
  }

  // Parse arguments
  const debug = "app_debug" in ARGS;
  const widget = ARGS.web_widget ? ARGS.web_widget === "true" : true;
  const theme = ["light", "dark"].includes(ARGS.web_theme) ? ARGS.web_theme : "dark";
  const zoom = (!isNaN(parseFloat(ARGS.web_zoom)) ? parseFloat(ARGS.web_zoom) : 1.25) * 100;
  const urls = [loaderHtml(40, 1.0, theme), ...ARGS.web_url];

  // Init global controls
  WEBVIEW.statusEnabled = !debug;
  WEBVIEW.pagerEnabled = widget;
  WEBVIEW.widgetEnabled = widget;
  WEBVIEW.navigationEnabled = widget;

  // Init global views
  WEBVIEW.views = [];
  WEBVIEW.viewUrls = urls;
  WEBVIEW.viewActive = 0;

  // Init global display
  const display = screen.getPrimaryDisplay();
  WEBVIEW.display = display ? display.workAreaSize : {};
  if (!WEBVIEW.display.width || !WEBVIEW.display.height) {
    WEBVIEW.display = { width: 800, height: 600 };
  }

  // Init global theme manager
  WEBVIEW.theme = {
    set: function (value) {
      const theme = value.toLowerCase();
      nativeTheme.themeSource = theme;
      if (typeof this.callback === "function") this.callback();
    },
    get: function () {
      return nativeTheme.shouldUseDarkColors ? "dark" : "light";
    },
    toggle: function () {
      this.set(nativeTheme.shouldUseDarkColors ? "light" : "dark");
    },
    reset: function () {
      this.set(this.default);
    },
    store: function () {
      cookieStore("web-theme", this.get());
    },
    init: function (value, callback) {
      this.callback = callback;
      this.default = value;
      this.reset();
    },
  };

  // Init global zoom manager
  WEBVIEW.zoom = {
    set: function (value) {
      const zoom = Math.max(0.25, Math.min(4.0, value / 100.0));
      WEBVIEW.views[WEBVIEW.viewActive].webContents.setZoomFactor(zoom);
      if (typeof this.callback === "function") this.callback();
    },
    get: function () {
      const zoom = WEBVIEW.views[WEBVIEW.viewActive].webContents.getZoomFactor();
      return Math.round(zoom * 100.0);
    },
    minus: function () {
      this.set(Math.floor((this.get() - 1) / 10) * 10);
    },
    plus: function () {
      this.set(Math.ceil((this.get() + 1) / 10) * 10);
    },
    reset: function () {
      this.set(this.default);
    },
    store: function () {
      cookieStore("web-zoom", this.get());
    },
    init: function (value, callback) {
      this.callback = callback;
      this.default = value;
      this.reset();
    },
  };

  // Init root window
  WEBVIEW.window = new BaseWindow({
    title: APP.title,
    icon: APP.icon,
    autoHideMenuBar: true,
    frame: !WEBVIEW.statusEnabled,
    width: Math.floor(WEBVIEW.display.width * 0.85),
    height: Math.floor(WEBVIEW.display.height * 0.75),
    minWidth: 136,
    minHeight: 136,
  });

  // Init global webview
  WEBVIEW.viewUrls.forEach((url, i) => {
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

  // Init global status
  WEBVIEW.status = new WebContentsView({
    transparent: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  WEBVIEW.status.setBackgroundColor("#00000000");
  WEBVIEW.window.contentView.addChildView(WEBVIEW.status);
  WEBVIEW.status.webContents.loadFile(path.join(APP.path, "html", "status.html"));

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

  // Init input blocking state management
  WEBVIEW.inputBlocking = {
    enabled: false,
    allViews: [], // Cached array of all views
  };

  // Init global layout
  const { width, height, x, y } = WEBVIEW.window.getBounds();
  console.info(`Open Window: ${width}x${height}+${x}+${y}`);
  WEBVIEW.theme.init(theme, updateTheme);
  WEBVIEW.zoom.init(zoom, updateZoom);

  // Cache all views array for input blocking
  WEBVIEW.inputBlocking.allViews = [...WEBVIEW.views, WEBVIEW.pager, WEBVIEW.widget, WEBVIEW.navigation, WEBVIEW.status];

  // Register global events
  await windowEvents();
  await widgetEvents();
  await statusEvents();
  await navigationEvents();
  await viewEvents();
  await appEvents();

  return true;
};

/**
 * Updates the shared webview properties.
 */
const update = async () => {
  if (!WEBVIEW.initialized || APP.exiting) {
    return;
  }
  console.debug("webview.js: update()");

  // Update window status
  updateStatus();

  // Update pager status
  updatePager();

  // Update widget status
  updateWidget();

  // Update navigation status
  updateNavigation();
};

/**
 * Updates the application theme.
 */
const updateTheme = () => {
  if (APP.exiting) {
    return;
  }
  const theme = WEBVIEW.theme.get();

  // Update controls theme
  WEBVIEW.statusTheme = theme;
  WEBVIEW.pagerTheme = theme;
  WEBVIEW.widgetTheme = theme;
  WEBVIEW.navigationTheme = theme;
  WEBVIEW.window.setMenuBarVisibility(false);

  // Update application theme
  WEBVIEW.theme.store();
  if (WEBVIEW.initialized) {
    console.info("Update Application Theme:", theme);
    resizeView();
  }
  EVENTS.emit("updatePage");
};

/**
 * Updates the page zoom.
 */
const updateZoom = () => {
  if (APP.exiting) {
    return;
  }
  const zoom = WEBVIEW.zoom.get();

  // Update page zoom
  WEBVIEW.zoom.store();
  if (WEBVIEW.initialized) {
    console.info("Update Page Zoom:", zoom);
  }
  EVENTS.emit("updatePage");
};

/**
 * Updates the active view.
 */
const updateView = () => {
  if (!WEBVIEW.viewActive) {
    return;
  }
  const view = WEBVIEW.views[WEBVIEW.viewActive];
  const url = view.webContents.getURL();

  // Build window title
  const host = url.startsWith("data:") ? "whoopsie" : new URL(url).host;
  const title = `${APP.title} - ${host} (${WEBVIEW.viewActive})`;
  const previous = WEBVIEW.window.getTitle();

  // Update window title
  if (previous !== title) {
    console.info(`Update View: ${title}`);
  }
  WEBVIEW.status.webContents.send("text-content", { id: "title", content: title });
  WEBVIEW.window.setTitle(title);

  // Hide all other webviews and show only the active one
  WEBVIEW.views.forEach((view, i) => {
    view.setVisible(i === WEBVIEW.viewActive);
  });

  // Update stored theme and zoom
  cookieStore("web-theme").then((value) => {
    if (value && value !== WEBVIEW.theme.get()) {
      WEBVIEW.theme.set(value);
    }
  });
  cookieStore("web-zoom").then((value) => {
    if (value && value !== WEBVIEW.zoom.get()) {
      WEBVIEW.zoom.set(value);
    }
  });

  // Update webview screenshot
  captureView(1000).then(() => {
    EVENTS.emit("updateScreenshot");
  });
  EVENTS.emit("updatePage");
  update();
};

/**
 * Updates the window status.
 */
const updateStatus = () => {
  const previous = WEBVIEW.tracker.window.status;

  // Set window status
  if (WEBVIEW.window.isFullScreen()) {
    WEBVIEW.tracker.window.status = "Fullscreen";
  } else if (WEBVIEW.window.isMinimized()) {
    WEBVIEW.tracker.window.status = "Minimized";
  } else if (WEBVIEW.window.isMaximized()) {
    WEBVIEW.tracker.window.status = "Maximized";
  } else {
    WEBVIEW.tracker.window.status = "Framed";
  }

  // Update window status
  if (previous !== WEBVIEW.tracker.window.status) {
    console.info(`Update Kiosk Status: ${WEBVIEW.tracker.window.status}`);
  }
  EVENTS.emit("updateStatus");
};

/**
 * Updates the pager control.
 */
const updatePager = () => {
  // Disable pager buttons
  WEBVIEW.pager.webContents.send("button-disabled", {
    id: "previous",
    disabled: WEBVIEW.viewActive <= 1,
  });
  WEBVIEW.pager.webContents.send("button-disabled", {
    id: "next",
    disabled: WEBVIEW.viewActive >= WEBVIEW.viewUrls.length - 1,
  });
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
  if (!WEBVIEW.viewActive) {
    return;
  }
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
    disabled: WEBVIEW.zoom.get() <= 25,
  });
  WEBVIEW.navigation.webContents.send("button-disabled", {
    id: "plus",
    disabled: WEBVIEW.zoom.get() >= 400,
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
 *
 * @param {string} force - Force the navigation bar visibility to 'ON' or 'OFF'.
 */
const toggleNavigation = (force = null) => {
  if (!WEBVIEW.navigationEnabled) {
    return;
  }
  const window = WEBVIEW.window.getBounds();
  const status = WEBVIEW.status.getBounds();
  const navigation = WEBVIEW.navigation.getBounds();

  // Calculate navigation height
  const height = force === "ON" ? 50 : force === "OFF" ? 0 : navigation.height > 0 ? 0 : 50;
  if (height === navigation.height) {
    return;
  }

  // Show or hide navigation based on height
  WEBVIEW.navigation.setBounds({
    x: 0,
    y: window.height - status.height - height,
    width: window.width,
    height: height,
  });

  // Resize webview
  resizeView();
};

/**
 * Shows or hides the webview status bar.
 *
 * @param {string} force - Force the status bar visibility to 'ON' or 'OFF'.
 */
const toggleStatus = (force = null) => {
  if (!WEBVIEW.statusEnabled) {
    return;
  }
  const window = WEBVIEW.window.getBounds();
  const status = WEBVIEW.status.getBounds();

  // Calculate status height
  const height = force === "ON" ? 40 : force === "OFF" ? 0 : status.height > 0 ? 0 : 40;
  if (height === status.height) {
    return;
  }

  // Show or hide status based on height
  WEBVIEW.status.setBounds({
    x: 0,
    y: 0,
    width: window.width,
    height: height,
  });

  // Resize webview
  resizeView();
};

/**
 * Decreases page zoom on the active webview.
 */
const zoomMinus = () => {
  if (!WEBVIEW.viewActive) {
    return;
  }
  WEBVIEW.zoom.minus();
  updateView();
};

/**
 * Increases page zoom on the active webview.
 */
const zoomPlus = () => {
  if (!WEBVIEW.viewActive) {
    return;
  }
  WEBVIEW.zoom.plus();
  updateView();
};

/**
 * Navigates backward in the history of the active webview.
 */
const historyBackward = () => {
  if (!WEBVIEW.viewActive) {
    return;
  }
  const view = WEBVIEW.views[WEBVIEW.viewActive];
  if (view.webContents.navigationHistory.canGoBack()) {
    view.webContents.navigationHistory.goBack();
  }
};

/**
 * Navigates forward in the history of the active webview.
 */
const historyForward = () => {
  if (!WEBVIEW.viewActive) {
    return;
  }
  const view = WEBVIEW.views[WEBVIEW.viewActive];
  if (view.webContents.navigationHistory.canGoForward()) {
    view.webContents.navigationHistory.goForward();
  }
};

/**
 * Activates the previous webview page.
 */
const previousView = () => {
  if (!WEBVIEW.viewActive) {
    return;
  }
  if (WEBVIEW.viewActive > 1) {
    WEBVIEW.viewActive--;
  }
  updateView();
};

/**
 * Activates the next webview page.
 */
const nextView = () => {
  if (!WEBVIEW.viewActive) {
    return;
  }
  if (WEBVIEW.viewActive < WEBVIEW.views.length - 1) {
    WEBVIEW.viewActive++;
  }
  updateView();
};

/**
 * Reloads the default url and settings on the active webview.
 */
const homeView = () => {
  if (!WEBVIEW.viewActive) {
    return;
  }
  const view = WEBVIEW.views[WEBVIEW.viewActive];
  const defaultUrl = WEBVIEW.viewUrls[WEBVIEW.viewActive];
  const currentUrl = view.webContents.getURL();

  // Clear logs, cache and history
  APP.logs = [];
  view.webContents.session.clearCache();
  view.webContents.navigationHistory.clear();

  // Reset page zoom and theme
  WEBVIEW.zoom.reset();
  WEBVIEW.theme.reset();

  // Reload the default url or refresh the page
  if (currentUrl != defaultUrl) {
    view.webContents.loadURL(defaultUrl);
  } else {
    view.webContents.reloadIgnoringCache();
  }
};

/**
 * Blocks all input on webviews by injecting JavaScript event blockers.
 */
const blockAllInput = async () => {
  if (WEBVIEW.inputBlocking.enabled || !WEBVIEW.inputBlocking.allViews) return;
  
  WEBVIEW.inputBlocking.enabled = true;
  
  const promises = WEBVIEW.inputBlocking.allViews.map(async (view) => {
    try {
      await view.webContents.executeJavaScript(`
        (function() {
          if (window.__touchkioBlocker) return;
          window.__touchkioBlocker = (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
          };
          const events = ['touchstart', 'touchmove', 'touchend', 'mousedown', 'mouseup', 'click', 'pointerdown', 'pointerup'];
          events.forEach(type => {
            document.addEventListener(type, window.__touchkioBlocker, { capture: true, passive: false });
          });
        })();
      `);
    } catch (error) {
      console.error(`webview.js: Failed to block input:`, error.message);
    }
  });
  
  await Promise.all(promises);
};

/**
 * Unblocks all input on webviews by removing JavaScript event blockers.
 */
const unblockAllInput = async () => {
  if (!WEBVIEW.inputBlocking.enabled || !WEBVIEW.inputBlocking.allViews) return;
  
  WEBVIEW.inputBlocking.enabled = false;
  
  const promises = WEBVIEW.inputBlocking.allViews.map(async (view) => {
    try {
      await view.webContents.executeJavaScript(`
        (function() {
          if (!window.__touchkioBlocker) return;
          const events = ['touchstart', 'touchmove', 'touchend', 'mousedown', 'mouseup', 'click', 'pointerdown', 'pointerup'];
          events.forEach(type => {
            document.removeEventListener(type, window.__touchkioBlocker, { capture: true });
          });
          delete window.__touchkioBlocker;
        })();
      `);
    } catch (error) {
      console.error(`webview.js: Failed to unblock input:`, error.message);
    }
  });
  
  await Promise.all(promises);
};

/**
 * Reloads the current url on the active webview.
 */
const reloadView = () => {
  if (!WEBVIEW.viewActive) {
    return;
  }
  const view = WEBVIEW.views[WEBVIEW.viewActive];
  const defaultUrl = WEBVIEW.viewUrls[WEBVIEW.viewActive];
  const currentUrl = view.webContents.getURL();

  // Clear logs and cache
  APP.logs = [];
  view.webContents.session.clearCache();

  // Reload the default url or refresh the page
  if (currentUrl.startsWith("data:")) {
    view.webContents.loadURL(defaultUrl);
  } else {
    view.webContents.reloadIgnoringCache();
  }
};

/**
 * Resizes and positions all webviews.
 */
const resizeView = () => {
  const window = WEBVIEW.window.getBounds();
  const status = WEBVIEW.status.getBounds();
  const navigation = WEBVIEW.navigation.getBounds();
  const pager = { width: 20, height: window.height };
  const widget = { width: 60, height: 200 };

  // Update view size
  WEBVIEW.views.forEach((view, i) => {
    console.debug(`webview.js: resizeView(${i})`);
    view.setBounds({
      x: 0,
      y: status.height,
      width: window.width,
      height: window.height - status.height - navigation.height,
    });
  });

  // Update pager size
  if (WEBVIEW.pagerEnabled) {
    WEBVIEW.pager.setBounds({
      x: window.width - pager.width,
      y: status.height,
      width: pager.width,
      height: pager.height - status.height - navigation.height,
    });
    WEBVIEW.pager.webContents.send("data-theme", {
      theme: WEBVIEW.viewUrls.length > 2 ? WEBVIEW.pagerTheme : "hidden",
    });
  }

  // Update widget size
  if (WEBVIEW.widgetEnabled) {
    WEBVIEW.widget.setBounds({
      x: WEBVIEW.tracker.widget.focused ? window.width - widget.width : window.width - pager.width,
      y: status.height + parseInt((window.height - status.height - widget.height) / 2, 10),
      width: widget.width,
      height: widget.height,
    });
    WEBVIEW.widget.webContents.send("data-theme", {
      theme: WEBVIEW.tracker.widget.focused ? WEBVIEW.widgetTheme : "hidden",
    });
  }

  // Update status size
  if (WEBVIEW.statusEnabled) {
    WEBVIEW.status.setBounds({
      x: 0,
      y: 0,
      width: window.width,
      height: status.height,
    });
    WEBVIEW.status.webContents.send("data-theme", {
      theme: WEBVIEW.statusTheme,
    });
  }

  // Update navigation size
  if (WEBVIEW.navigationEnabled) {
    WEBVIEW.navigation.setBounds({
      x: 0,
      y: window.height - navigation.height,
      width: window.width,
      height: navigation.height,
    });
    WEBVIEW.navigation.webContents.send("data-theme", {
      theme: WEBVIEW.navigationTheme,
    });
  }

  // Update webview screenshot
  captureView(1000).then(() => {
    EVENTS.emit("updateScreenshot");
  });
};

/**
 * Register window events and handler.
 */
const windowEvents = async () => {
  console.debug("webview.js: windowEvents()");

  // Handle window status updates
  WEBVIEW.window.setStatus = async (status) => {
    const apply = (func, ...args) => {
      func.apply(WEBVIEW.window, args);
      return new Promise((r) => setTimeout(r, 50));
    };
    if (WEBVIEW.window.isMinimized()) {
      await apply(WEBVIEW.window.restore);
    }
    switch (status) {
      case "Framed":
        if (WEBVIEW.window.isFullScreen()) {
          await apply(WEBVIEW.window.setFullScreen, false);
        }
        if (WEBVIEW.window.isMaximized()) {
          await apply(WEBVIEW.window.unmaximize);
        }
        break;
      case "Fullscreen":
        if (!WEBVIEW.window.isMaximized()) {
          await apply(WEBVIEW.window.maximize);
        }
        if (!WEBVIEW.window.isFullScreen()) {
          await apply(WEBVIEW.window.setFullScreen, true);
        }
        break;
      case "Maximized":
        if (WEBVIEW.window.isFullScreen()) {
          await apply(WEBVIEW.window.setFullScreen, false);
        }
        if (!WEBVIEW.window.isMaximized()) {
          await apply(WEBVIEW.window.maximize);
        }
        break;
      case "Minimized":
        if (WEBVIEW.window.isFullScreen()) {
          await apply(WEBVIEW.window.setFullScreen, false);
        }
        if (!WEBVIEW.window.isMinimized()) {
          await apply(WEBVIEW.window.minimize);
        }
        break;
      case "Terminated":
        process.exitCode = 0;
        app.quit();
        break;
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

  // Handle window resize events
  WEBVIEW.window.on("resize", resizeView);
  resizeView();

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

  // Check for window touch events (every full 1s)
  interval(() => {
    if (APP.exiting) {
      return;
    }
    const now = new Date();
    const then = WEBVIEW.tracker.pointer.time;
    const delta = (now - then) / 1000;

    // Auto-hide controls
    if (delta > 60) {
      if (WEBVIEW.tracker.widget.focused) {
        WEBVIEW.views[WEBVIEW.viewActive].webContents.focus();
      }
      toggleNavigation("OFF");
    }
  }, 1 * 1000);
};

/**
 * Register widget events and handler.
 */
const widgetEvents = async () => {
  if (!WEBVIEW.widgetEnabled) {
    return;
  }
  console.debug("webview.js: widgetEvents()");

  // Handle widget focus events
  WEBVIEW.widget.webContents.on("focus", () => {
    WEBVIEW.tracker.pointer.time = new Date();
    const window = WEBVIEW.window.getBounds();
    const widget = WEBVIEW.widget.getBounds();

    // Show widget
    WEBVIEW.widget.setBounds({
      x: window.width - 60,
      y: widget.y,
      width: widget.width,
      height: widget.height,
    });
    WEBVIEW.widget.webContents.send("data-theme", {
      theme: WEBVIEW.widgetTheme,
    });
    WEBVIEW.tracker.widget.focused = true;
    console.debug("webview.js: widgetEvents(widget-focus)");
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
    WEBVIEW.widget.webContents.send("data-theme", {
      theme: "hidden",
    });
    WEBVIEW.tracker.widget.focused = false;
    console.debug("webview.js: widgetEvents(widget-blur)");
  });

  // Handle widget button click events
  ipcMain.on("button-click", (e, button) => {
    console.debug(`webview.js: widgetEvents(button-click-${button.id})`);
    WEBVIEW.tracker.pointer.time = new Date();
    switch (button.id) {
      case "fullscreen":
        WEBVIEW.window.setStatus(WEBVIEW.tracker.window.status === "Fullscreen" ? "Framed" : "Fullscreen");
        break;
      case "theme":
        WEBVIEW.theme.toggle();
        break;
      case "keyboard":
        hardware.setKeyboardVisibility(hardware.getKeyboardVisibility() === "ON" ? "OFF" : "ON");
        break;
      case "navigation":
        toggleNavigation();
        break;
    }
  });
};

/**
 * Register status events and handler.
 */
const statusEvents = async () => {
  if (!WEBVIEW.statusEnabled) {
    return;
  }
  console.debug("webview.js: statusEvents()");

  // Handle status button click events
  ipcMain.on("button-click", (e, button) => {
    console.debug(`webview.js: statusEvents(button-click-${button.id})`);
    WEBVIEW.tracker.pointer.time = new Date();
    switch (button.id) {
      case "minimize":
        WEBVIEW.window.setStatus("Minimized");
        break;
      case "terminate":
        WEBVIEW.status.webContents.send("button-disabled", { id: "fullscreen", disabled: true });
        WEBVIEW.status.webContents.send("button-disabled", { id: "minimize", disabled: true });
        WEBVIEW.status.webContents.send("button-disabled", { id: "terminate", disabled: true });
        const button = dialog.showMessageBoxSync(WEBVIEW.window, {
          type: "question",
          title: "Confirm",
          message: `\nExit ${APP.title}?`,
          buttons: ["No", "Yes"],
        });
        switch (button) {
          case 1:
            WEBVIEW.window.setStatus("Terminated");
            break;
          default:
            WEBVIEW.status.webContents.send("button-disabled", { id: "fullscreen", disabled: false });
            WEBVIEW.status.webContents.send("button-disabled", { id: "minimize", disabled: false });
            WEBVIEW.status.webContents.send("button-disabled", { id: "terminate", disabled: false });
        }
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
  console.debug("webview.js: navigationEvents()");

  // Handle input blur events
  let selected = false;
  ipcMain.on("input-blur", (e, input) => {
    console.debug(`webview.js: navigationEvents(input-blur-${input.id})`);
    switch (input.id) {
      case "url":
        if (selected) {
          hardware.setKeyboardVisibility("OFF", () => {
            selected = false;
            WEBVIEW.navigation.webContents.send("input-select", { id: "url", select: selected });
            WEBVIEW.navigation.webContents.send("input-readonly", { id: "url", readonly: !selected });
          });
        }
        break;
    }
  });

  // Handle input focus events
  ipcMain.on("input-focus", (e, input) => {
    console.debug(`webview.js: navigationEvents(input-focus-${input.id})`);
    WEBVIEW.tracker.pointer.time = new Date();
    switch (input.id) {
      case "url":
        hardware.setKeyboardVisibility("ON", () => {
          setTimeout(() => {
            selected = true;
            WEBVIEW.navigation.webContents.focus();
            WEBVIEW.navigation.webContents.send("input-select", { id: "url", select: selected });
            WEBVIEW.navigation.webContents.send("input-readonly", { id: "url", readonly: !selected });
          }, 400);
        });
        break;
    }
  });

  // Handle input enter events
  ipcMain.on("input-enter", (e, input) => {
    console.debug(`webview.js: navigationEvents(input-enter-${input.id})`);
    WEBVIEW.tracker.pointer.time = new Date();
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
    console.debug(`webview.js: navigationEvents(button-click-${button.id})`);
    WEBVIEW.tracker.pointer.time = new Date();
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

  const loaded = (i) => {
    if (WEBVIEW.viewActive) {
      return true;
    }

    // Set window status to fullscreen
    if (i === 0 && !("app_debug" in ARGS)) {
      WEBVIEW.window.setStatus("Fullscreen");
    }

    // Hide loader and show first view
    const done = ready.length >= WEBVIEW.views.length;
    if (done) {
      WEBVIEW.viewActive = 1;
      updateView();
    }
    console.debug(`webview.js: viewEvents(${i},loaded-${ready.length}/${WEBVIEW.views.length})`);

    return done;
  };

  // Handle events per webview
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
    view.webContents.once("dom-ready", () => {
      console.debug(`webview.js: viewEvents(${i},dom-ready)`);
      if ("app_reset" in ARGS) {
        cookieStore("web-theme", WEBVIEW.theme.default, view);
        cookieStore("web-zoom", WEBVIEW.zoom.default, view);
      }
      ready.push(i);
    });
    view.webContents.on("dom-ready", () => {
      view.webContents.insertCSS("::-webkit-scrollbar { display: none; }");
    });

    // Webview fully loaded
    view.webContents.on("did-finish-load", () => {
      console.debug(`webview.js: viewEvents(${i},did-finish-load)`);
      if ("app_debug" in ARGS) {
        setTimeout(() => {
          view.webContents.openDevTools();
        }, 2000);
      }
      loaded(i);
    });

    // Webview not loaded
    view.webContents.on("did-fail-load", (e, code, text, url, mainframe) => {
      if (mainframe) {
        console.debug(`webview.js: viewEvents(${i},did-fail-load)`);
        switch (code) {
          case -3:
            console.warn(`Load Warning: ${url}, ERR_ABORTED (${code})`);
            break;
          default:
            console.error(`Load Error: ${url}, ${text} (${code})`);
            view.webContents.loadURL(errorHtml(code, text, url, WEBVIEW.theme.get()));
        }
        loaded(i);
      }
    });

    // Webview url changed
    view.webContents.on("did-navigate", () => {
      console.debug(`webview.js: viewEvents(${i},did-navigate)`);
      updateView();
    });
    view.webContents.on("did-navigate-in-page", (e, url, mainframe) => {
      if (mainframe) {
        console.debug(`webview.js: viewEvents(${i},did-navigate-in-page)`);
        updateView();
      }
    });

    // Handle webview input events (catches keyboard and mouse)
    view.webContents.on("before-input-event", (e, input) => {
      const justWokeUp = WEBVIEW.tracker.display.lastWakeup && 
                         (new Date() - WEBVIEW.tracker.display.lastWakeup) < 500;
      const displayOff = WEBVIEW.tracker.display.off > WEBVIEW.tracker.display.on;

      if (displayOff || justWokeUp) {
        e.preventDefault();
        return;
      }
    });

    // Handle webview mouse events
    view.webContents.on("before-mouse-event", (e, mouse) => {
      const justWokeUp = WEBVIEW.tracker.display.lastWakeup && 
                         (new Date() - WEBVIEW.tracker.display.lastWakeup) < 500;
      const displayOff = WEBVIEW.tracker.display.off > WEBVIEW.tracker.display.on;

      // Wake display on touch when off
      if (displayOff && mouse.type !== "mouseLeave") {
        e.preventDefault();
        WEBVIEW.tracker.display.lastWakeup = new Date();
        hardware.setDisplayStatus("ON");
        return;
      }

      // Block input during wakeup period
      if (displayOff || justWokeUp) {
        e.preventDefault();
        return;
      }
      const now = new Date();
      const then = WEBVIEW.tracker.pointer.time;
      const delta = (now - then) / 1000;

      // Check mouse event type
      switch (mouse.type) {
        case "mouseMove":
          const posNew = { x: Math.round(mouse.globalX), y: Math.round(mouse.globalY) };
          if (posNew.x < 0 || posNew.y < 0) {
            break;
          }
          console.debug(`webview.js: viewEvents(${i},${mouse.type}-${posNew.x}-${posNew.y})`);

          // Update tracker pointer time and position
          const posOld = WEBVIEW.tracker.pointer.position;
          if (posOld.x !== posNew.x || posOld.y !== posNew.y) {
            WEBVIEW.tracker.pointer.time = now;
            WEBVIEW.tracker.pointer.position = posNew;

            // Trigger motion sensor update
            EVENTS.emit("updateMotion", true);

            // Update last active on pointer position change
            if (delta > 30) {
              console.info("Update Last Active");
              integration.update();
            }
          }
          break;
        case "mouseDown":
          console.debug(`webview.js: viewEvents(${i},${mouse.type}-${mouse.button})`);
          switch (mouse.button) {
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
  console.debug("webview.js: appEvents()");

  // Periodically check display status and block input if needed (every 100ms)
  setInterval(() => {
    if (APP.exiting) return;
    
    const justWokeUp = WEBVIEW.tracker.display.lastWakeup && 
                       (new Date() - WEBVIEW.tracker.display.lastWakeup) < 500; // 500ms grace period
    const displayOff = WEBVIEW.tracker.display.off > WEBVIEW.tracker.display.on;
    const shouldBlock = displayOff || justWokeUp;
    
    if (shouldBlock && !WEBVIEW.inputBlocking.enabled) {
      blockAllInput();
    } else if (!shouldBlock && WEBVIEW.inputBlocking.enabled) {
      unblockAllInput();
    }
  }, 500);

  // Handle global events
  EVENTS.on("reloadView", reloadView);
  EVENTS.on("updateView", updateView);
  EVENTS.on("updateDisplay", () => {
    const status = hardware.getDisplayStatus();
    if (status) {
      WEBVIEW.tracker.display[status.toLowerCase()] = new Date();
      if (status === "OFF") {
        blockAllInput();
      }
    } else {
      console.warn("webview.js: Failed to retrieve display status");
    }
  });
  EVENTS.on("updateStatus", () => {
    const status = WEBVIEW.tracker.window.status;
    const visibility = hardware.getKeyboardVisibility();
    if (visibility === "ON" && ["Fullscreen", "Minimized"].includes(status)) {
      hardware.setKeyboardVisibility("OFF");
    }
    toggleStatus(["Framed", "Minimized"].includes(status) ? "ON" : "OFF");
  });
  EVENTS.on("updateKeyboard", () => {
    const status = WEBVIEW.tracker.window.status;
    const visibility = hardware.getKeyboardVisibility();
    if (visibility === "ON" && ["Fullscreen"].includes(status)) {
      WEBVIEW.window.setStatus("Maximized");
    } else if (visibility === "OFF" && ["Maximized"].includes(status)) {
      WEBVIEW.window.setStatus("Fullscreen");
    }
  });

  // Handle multiple instances
  app.on("second-instance", () => {
    if (WEBVIEW.window.isMinimized()) {
      WEBVIEW.window.restore();
    }
    WEBVIEW.window.focus();
  });

  // Handle crash events
  app.on("render-process-gone", (e, wc, details) => {
    const url = wc.getURL() || "Unknown";
    if (!url.startsWith("data:")) {
      console.error(`Render Process ${details.reason} (code ${details.exitCode}): ${url}`);
    }
    reloadView();
  });
  app.on("child-process-gone", (e, details) => {
    const name = details.name || details.serviceName || "Unknown";
    console.error(`${details.type} Process ${details.reason} (code ${details.exitCode}): ${name}`);
  });

  // Update latest screenshot (every full 1min)
  interval(() => {
    if (APP.exiting) {
      return;
    }
    captureView(5000).then(() => {
      EVENTS.emit("updateScreenshot");
    });
  }, 60 * 1000);

  // Check latest release (every full 2h)
  interval(() => {
    if (APP.exiting) {
      return;
    }
    latestRelease();
  }, 7200 * 1000);
  latestRelease();

  // Webview initialized
  WEBVIEW.initialized = true;
};

/**
 * Fetches the latest app release infos from github.
 */
const latestRelease = async () => {
  try {
    const response = await axios.get(APP.releases.url, { timeout: 20000 });
    const release = response?.data?.find((item) => {
      return !item.draft && (!item.prerelease || "app_early" in ARGS);
    });
    if (release) {
      APP.releases.latest = {
        title: APP.title,
        version: (release.tag_name || " ").replace(/^v/i, ""),
        summary: release.body || " ",
        url: release.html_url || " ",
      };
      EVENTS.emit("updateApp");
    }
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
          await axios.get(url, { httpsAgent: agent, timeout: 20000 });
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
 * Stores, retrieves or deletes a cookie from the active webview.
 *
 * @param {string} key - The key of the webview cookie.
 * @param {string|number} value - The value of the webview cookie.
 * @param {WebContentsView} view - The webview that stores the cookie.
 * @returns {Promise<string|number>} The value of the webview cookie.
 */
const cookieStore = async (key, value, view = WEBVIEW.views[WEBVIEW.viewActive]) => {
  const url = view ? view.webContents.getURL() : null;
  if (!url || url.startsWith("data:")) {
    return;
  }

  // Use origin session cookies
  const name = `${APP.name}-${key}`;
  const origin = new URL(url).origin;
  const cookies = view.webContents.session.cookies;
  const expires = Math.floor(Date.now() / 1000) + 3600 * 24 * 365;

  // Delete cookie if value is null
  if (value === null) {
    await cookies.remove(origin, name);
    return null;
  }

  // Write cookie if value is provided
  if (value !== undefined) {
    await cookies.set({ url: origin, name: name, value: `${value}`, expirationDate: expires });
    return value;
  }

  // Read cookie if no value is provided
  const cookie = (await cookies.get({ url: origin, name: name }))[0] || {};
  return !isNaN(Number(cookie.value)) ? Number(cookie.value) : cookie.value;
};

/**
 * Captures a webview screenshot as a base64 image.
 *
 * @param {number} wait - The time to wait before capturing in milliseconds.
 * @param {WebContentsView} view - The webview that captures the page.
 * @returns {Promise<string|null>} The base64 image of the captured page or null if failed.
 */
const captureView = async (wait, view = WEBVIEW.views[WEBVIEW.viewActive]) => {
  await new Promise((r) => setTimeout(r, wait));
  const image = await view.webContents.capturePage();
  const dataUrl = image.toDataURL();
  const dataString = dataUrl.replace(/^data:image\/\w+;base64,/, "").trim();
  WEBVIEW.tracker.screenshot = dataString || WEBVIEW.tracker.screenshot;
  return WEBVIEW.tracker.screenshot;
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
 * @param {string} theme - The theme used for text colors.
 * @returns {string} A data string with the generated html.
 */
const errorHtml = (code, text, url, theme) => {
  const color = {
    dark: { icon: "#FFA500", text: "#E5E5E5", background: "#111111" },
    light: { icon: "#FFA500", text: "#1A1A1A", background: "#FAFAFA" },
  }[theme];
  const html = `
    <html>
      <head>
        <style>
          body {
            display: flex;
            align-items: center;
            text-align: center;
            justify-content: center;
            font-family: sans-serif;
            background-color: ${color.background};
          }
          .icon {
            margin: 0;
            font-size: 5rem;
            color: ${color.icon};
          }
          .title {
            margin: 0;
            color: ${color.text};
          }
          .url {
            color: ${color.text};
          }
          .error {
            color: ${color.text};
          }
        </style>
      </head>
      <body>
        <div>
          <p class="icon">&#9888;</p>
          <h1 class="title">Whoopsie!</h1>
          <p class="url"><strong>Loading:</strong> ${url}</p>
          <p class="error"><strong>Error:</strong> ${text} (${code})</p>
        </div>
      </body>
    </html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
};

/**
 * Interval function that runs at interval boundaries.
 *
 * @param {Function} callback - The function to execute.
 * @param {number} ms - The interval time in milliseconds.
 */
const interval = (callback, ms) => {
  const delay = ms - (Date.now() % ms);
  setTimeout(() => {
    callback();
    setInterval(callback, ms);
  }, delay);
};

module.exports = {
  init,
  update,
};
