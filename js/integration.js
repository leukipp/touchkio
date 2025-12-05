const mqtt = require("mqtt");
const hardware = require("./hardware");
const { app } = require("electron");

global.INTEGRATION = global.INTEGRATION || {
  initialized: false,
};

/**
 * Initializes the integration with the provided arguments.
 *
 * @returns {bool} Returns true if the initialization was successful.
 */
const init = async () => {
  if (!ARGS.mqtt_url) {
    return false;
  }
  if (!/^mqtts?:\/\//.test(ARGS.mqtt_url)) {
    console.error("Please provide the '--mqtt-url' parameter with mqtt(s)");
    return app.quit();
  }

  // Parse arguments
  const url = new URL(ARGS.mqtt_url);
  const user = ARGS.mqtt_user ? ARGS.mqtt_user : null;
  const password = ARGS.mqtt_password ? ARGS.mqtt_password : null;
  const discovery = ARGS.mqtt_discovery ? ARGS.mqtt_discovery : "homeassistant";

  const model = hardware.getModel();
  const vendor = hardware.getVendor();
  const hostName = hardware.getHostName();
  const serialNumber = hardware.getSerialNumber();
  const serialNumberSuffix = serialNumber.slice(-6);
  const deviceName = hostName.charAt(0).toUpperCase() + hostName.slice(1);
  const deviceId = serialNumberSuffix.toUpperCase().replace(/[^A-Z0-9]/g, "");

  // Init globals
  INTEGRATION.discovery = discovery;
  INTEGRATION.node = `rpi_${deviceId}`;
  INTEGRATION.root = `${APP.name}/${INTEGRATION.node}`;
  INTEGRATION.device = {
    name: `${APP.title} ${deviceName}`,
    model: model,
    manufacturer: vendor,
    serial_number: serialNumber,
    identifiers: [INTEGRATION.node],
    sw_version: `${APP.name}-v${APP.version}`,
    configuration_url: APP.homepage,
  };

  // Init options
  const masked = password === null ? null : "*".repeat(password.length);
  const options = user === null || password === null ? {} : { username: user, password: password };
  options.will = { topic: `${INTEGRATION.root}/kiosk/state`, payload: "Terminated", qos: 1, retain: true };
  options.rejectUnauthorized = !("ignore_certificate_errors" in ARGS);

  // Client connect
  console.info("MQTT Connecting:", `${user}:${masked}@${url.toString()}`);
  INTEGRATION.client = mqtt.connect(url.toString(), options);
  INTEGRATION.client.setMaxListeners(20);

  // Client connected
  INTEGRATION.client
    .once("connect", () => {
      console.info(`MQTT Connected: ${url.toString()}`);
      process.stdout.write("\n");

      // Init client controls
      initApp();
      initShutdown();
      initReboot();
      initRefresh();
      initKiosk();
      initTheme();
      initDisplay();
      initVolume();
      initKeyboard();
      initPageNumber();
      initPageZoom();
      initPageUrl();

      // Init client sensors
      initModel();
      initSerialNumber();
      initHostName();
      initNetworkAddress();
      initUpTime();
      initMemorySize();
      initMemoryUsage();
      initProcessorUsage();
      initProcessorTemperature();
      initBatteryLevel();
      initPackageUpgrades();
      initLastActive();
      initMotion();

      // Init client diagnostic
      initScreenshot();
      initHeartbeat();
      initErrors();
      initVersion();

      // Integration initialized
      INTEGRATION.initialized = true;

      // Register global events
      EVENTS.on("updateApp", updateApp);
      EVENTS.on("updateStatus", updateKiosk);
      EVENTS.on("updateVolume", updateVolume);
      EVENTS.on("updateKeyboard", updateKeyboard);
      EVENTS.on("updatePage", () => {
        updatePageNumber();
        updatePageZoom();
        updatePageUrl();
        updateTheme();
      });
      EVENTS.on("updateDisplay", () => {
        updateDisplay();
        updateLastActive();
      });
      EVENTS.on("updateMotion", updateMotion);
      EVENTS.on("updateScreenshot", updateScreenshot);
      EVENTS.on("consoleLog", updateErrors);
    })
    .on("error", (error) => {
      console.error("MQTT", error.message);
    });

  // Update time sensors periodically (30s)
  setInterval(() => {
    if (APP.exiting) {
      return;
    }
    updateLastActive();
    updateHeartbeat();
    updateErrors();
  }, 30 * 1000);

  // Update system sensors periodically (1min)
  setInterval(() => {
    if (APP.exiting) {
      return;
    }
    update();
  }, 60 * 1000);

  // Update upgrade sensors periodically (1h)
  setInterval(() => {
    if (APP.exiting) {
      return;
    }
    updatePackageUpgrades();
  }, 3600 * 1000);

  return true;
};

/**
 * Updates the shared integration properties.
 */
const update = async () => {
  if (!INTEGRATION.initialized || APP.exiting) {
    return;
  }
  console.debug("integration.js: update()");

  updateNetworkAddress();
  updateUpTime();
  updateLastActive();
  updateMemoryUsage();
  updateProcessorUsage();
  updateProcessorTemperature();
  updateBatteryLevel();
};

/**
 * Removes the auto-discovery config via the mqtt connection.
 *
 *  @param {string} type - The entity type name.
 *  @param {Object} config - The configuration object.
 *  @returns {Object} Instance of the mqtt client.
 */
const removeConfig = (type, config) => {
  if (type === null || config === null) {
    return INTEGRATION.client;
  }
  const path = config.unique_id.replace(`${INTEGRATION.node}_`, "");
  const root = `${INTEGRATION.discovery}/${type}/${INTEGRATION.node}/${path}/config`;
  console.debug(`integration.js: removeConfig(${path})`);
  return INTEGRATION.client.publish(root, JSON.stringify({}), { qos: 1, retain: true });
};

/**
 * Publishes the auto-discovery config via the mqtt connection.
 *
 *  @param {string} type - The entity type name.
 *  @param {Object} config - The configuration object.
 *  @returns {Object} Instance of the mqtt client.
 */
const publishConfig = (type, config) => {
  if (type === null || config === null) {
    return INTEGRATION.client;
  }
  const path = config.unique_id.replace(`${INTEGRATION.node}_`, "");
  const root = `${INTEGRATION.discovery}/${type}/${INTEGRATION.node}/${path}/config`;
  console.debug(`integration.js: publishConfig(${path})`);
  return INTEGRATION.client.publish(root, JSON.stringify(config), { qos: 1, retain: true });
};

/**
 * Publishes the sensor attributes via the mqtt connection.
 *
 *  @param {string} path - The entity path name.
 *  @param {Object} attributes - The attributes object.
 *  @returns {Object} Instance of the mqtt client.
 */
const publishAttributes = (path, attributes) => {
  if (path === null || attributes === null) {
    return INTEGRATION.client;
  }
  const root = `${INTEGRATION.root}/${path}/attributes`;
  return INTEGRATION.client.publish(root, JSON.stringify(attributes), { qos: 1, retain: true });
};

/**
 * Publishes the sensor state via the mqtt connection.
 *
 *  @param {string} path - The entity path name.
 *  @param {string|number} state - The state value.
 *  @returns {Object} Instance of the mqtt client.
 */
const publishState = (path, state) => {
  if (path === null || state === null) {
    return INTEGRATION.client;
  }
  const root = `${INTEGRATION.root}/${path}/state`;
  return INTEGRATION.client.publish(root, `${state}`, { qos: 1, retain: true });
};

/**
 * Initializes the app update entity and handles the execute logic.
 */
const initApp = () => {
  const root = `${INTEGRATION.root}/app`;
  const config = {
    name: "App",
    unique_id: `${INTEGRATION.node}_app`,
    command_topic: `${root}/install`,
    state_topic: `${root}/version/state`,
    payload_install: "app_early" in ARGS ? "update early" : "update",
    device: INTEGRATION.device,
  };
  if (!HARDWARE.support.appUpdate) {
    removeConfig("update", config);
    return;
  }
  publishConfig("update", config)
    .on("message", (topic, message) => {
      if (topic === config.command_topic) {
        console.info("Update App...");
        hardware.setDisplayStatus("ON", () => {
          const args = ["-c", `bash <(wget -qO- ${APP.scripts.install}) ${message.toString()}`];
          hardware.execScriptCommand("bash", args, (progress, error) => {
            if (progress) {
              console.info(`Progress: ${progress}%`);
            }
            updateApp(progress);
          });
        });
      }
    })
    .subscribe(config.command_topic);
  updateApp();
};

/**
 * Updates the app update entity via the mqtt connection.
 */
const updateApp = async (progress = 0) => {
  const latest = APP.releases.latest;
  if (!HARDWARE.support.appUpdate || !latest || !latest.summary) {
    return;
  }
  const summary = latest.summary.length > 250 ? latest.summary.slice(0, 250) + "..." : latest.summary;
  const version = {
    title: latest.title,
    latest_version: latest.version,
    installed_version: APP.version,
    release_summary: summary,
    release_url: latest.url,
    update_percentage: progress || null,
    in_progress: progress && progress > 0 && progress < 100,
  };
  publishState("app/version", JSON.stringify(version));
};

/**
 * Initializes the shutdown button and handles the execute logic.
 */
const initShutdown = () => {
  const root = `${INTEGRATION.root}/shutdown`;
  const config = {
    name: "Shutdown",
    unique_id: `${INTEGRATION.node}_shutdown`,
    command_topic: `${root}/execute`,
    icon: "mdi:power",
    device: INTEGRATION.device,
  };
  if (!HARDWARE.support.sudoRights) {
    removeConfig("button", config);
    return;
  }
  publishConfig("button", config)
    .on("message", (topic, message) => {
      if (topic === config.command_topic) {
        console.verbose("Shutdown system...");
        hardware.setDisplayStatus("ON", () => {
          hardware.shutdownSystem();
        });
      }
    })
    .subscribe(config.command_topic);
};

/**
 * Initializes the reboot button and handles the execute logic.
 */
const initReboot = () => {
  const root = `${INTEGRATION.root}/reboot`;
  const config = {
    name: "Reboot",
    unique_id: `${INTEGRATION.node}_reboot`,
    command_topic: `${root}/execute`,
    icon: "mdi:restart",
    device: INTEGRATION.device,
  };
  if (!HARDWARE.support.sudoRights) {
    removeConfig("button", config);
    return;
  }
  publishConfig("button", config)
    .on("message", (topic, message) => {
      if (topic === config.command_topic) {
        console.verbose("Rebooting system...");
        hardware.setDisplayStatus("ON", () => {
          hardware.rebootSystem();
        });
      }
    })
    .subscribe(config.command_topic);
};

/**
 * Initializes the refresh button and handles the execute logic.
 */
const initRefresh = () => {
  const root = `${INTEGRATION.root}/refresh`;
  const config = {
    name: "Refresh",
    unique_id: `${INTEGRATION.node}_refresh`,
    command_topic: `${root}/execute`,
    icon: "mdi:web-refresh",
    device: INTEGRATION.device,
  };
  publishConfig("button", config)
    .on("message", (topic, message) => {
      if (topic === config.command_topic) {
        console.verbose("Refreshing webview...");
        hardware.setDisplayStatus("ON", () => {
          EVENTS.emit("reloadView");
        });
      }
    })
    .subscribe(config.command_topic);
};

/**
 * Initializes the kiosk select status and handles the execute logic.
 */
const initKiosk = () => {
  const root = `${INTEGRATION.root}/kiosk`;
  const config = {
    name: "Kiosk",
    unique_id: `${INTEGRATION.node}_kiosk`,
    command_topic: `${root}/set`,
    state_topic: `${root}/state`,
    value_template: "{{ value }}",
    options: ["Framed", "Fullscreen", "Maximized", "Minimized", "Terminated"],
    icon: "mdi:overscan",
    device: INTEGRATION.device,
  };
  publishConfig("select", config)
    .on("message", (topic, message) => {
      if (topic === config.command_topic) {
        const status = message.toString();
        console.verbose("Set Kiosk Status:", status);
        hardware.setDisplayStatus("ON", () => {
          WEBVIEW.window.setStatus(status);
        });
      }
    })
    .subscribe(config.command_topic);
  updateKiosk();
};

/**
 * Updates the kiosk status via the mqtt connection.
 */
const updateKiosk = async () => {
  const kiosk = WEBVIEW.tracker.window.status;
  publishState("kiosk", kiosk);
};

/**
 * Initializes the application theme and handles the execute logic.
 */
const initTheme = () => {
  const root = `${INTEGRATION.root}/theme`;
  const config = {
    name: "Theme",
    unique_id: `${INTEGRATION.node}_theme`,
    command_topic: `${root}/set`,
    state_topic: `${root}/state`,
    value_template: "{{ value }}",
    options: ["Light", "Dark"],
    icon: "mdi:compare",
    device: INTEGRATION.device,
  };
  publishConfig("select", config)
    .on("message", (topic, message) => {
      if (topic === config.command_topic) {
        const theme = message.toString().toLowerCase();
        console.verbose("Set Application Theme:", theme);
        WEBVIEW.theme.set(theme);
      }
    })
    .subscribe(config.command_topic);
  updateTheme();
};

/**
 * Updates the application theme via the mqtt connection.
 */
const updateTheme = async () => {
  const theme = WEBVIEW.theme.get();
  publishState("theme", theme.charAt(0).toUpperCase() + theme.slice(1));
};

/**
 * Initializes the display status, brightness and handles the execute logic.
 */
const initDisplay = () => {
  const root = `${INTEGRATION.root}/display`;
  const config = {
    name: "Display",
    unique_id: `${INTEGRATION.node}_display`,
    command_topic: `${root}/power/set`,
    state_topic: `${root}/power/state`,
    supported_color_modes: ["onoff"],
    icon: "mdi:monitor-shimmer",
    platform: "light",
    device: INTEGRATION.device,
    ...(HARDWARE.support.displayBrightness && {
      supported_color_modes: ["brightness"],
      brightness_command_topic: `${root}/brightness/set`,
      brightness_state_topic: `${root}/brightness/state`,
      brightness_scale: 100,
    }),
  };
  if (!HARDWARE.support.displayStatus) {
    removeConfig("light", config);
    return;
  }
  publishConfig("light", config)
    .on("message", (topic, message) => {
      if (topic === config.command_topic) {
        const status = message.toString();
        console.verbose("Set Display Status:", status);
        hardware.setDisplayStatus(status, (reply, error) => {
          if (!error) {
            hardware.update();
          } else {
            console.warn("Command Failed:", error);
          }
        });
      } else if (topic === config.brightness_command_topic) {
        const brightness = parseInt(message, 10);
        console.verbose("Set Display Brightness:", brightness);
        hardware.setDisplayBrightness(brightness, (reply, error) => {
          if (!error) {
            hardware.update();
          } else {
            console.warn("Command Failed:", error);
          }
        });
      }
    })
    .subscribe(config.command_topic)
    .subscribe(config.brightness_command_topic);
  updateDisplay();
};

/**
 * Updates the display status, brightness via the mqtt connection.
 */
const updateDisplay = async () => {
  const status = hardware.getDisplayStatus();
  const brightness = hardware.getDisplayBrightness();
  publishState("display/brightness", brightness);
  publishState("display/power", status);
};

/**
 * Initializes the audio volume and handles the execute logic.
 */
const initVolume = () => {
  const root = `${INTEGRATION.root}/volume`;
  const config = {
    name: "Volume",
    unique_id: `${INTEGRATION.node}_volume`,
    command_topic: `${root}/set`,
    state_topic: `${root}/state`,
    value_template: "{{ value | int }}",
    mode: "slider",
    min: 0,
    max: 100,
    unit_of_measurement: "%",
    icon: "mdi:volume-high",
    device: INTEGRATION.device,
  };
  if (!HARDWARE.support.audioVolume) {
    removeConfig("number", config);
    return;
  }
  publishConfig("number", config)
    .on("message", (topic, message) => {
      if (topic === config.command_topic) {
        const volume = parseInt(message, 10);
        console.verbose("Set Audio Volume:", volume);
        hardware.setAudioVolume(volume);
      }
    })
    .subscribe(config.command_topic);
  updateVolume();
};

/**
 * Updates the audio volume via the mqtt connection.
 */
const updateVolume = async () => {
  const volume = hardware.getAudioVolume();
  publishState("volume", volume);
};

/**
 * Initializes the keyboard visibility and handles the execute logic.
 */
const initKeyboard = () => {
  const root = `${INTEGRATION.root}/keyboard`;
  const config = {
    name: "Keyboard",
    unique_id: `${INTEGRATION.node}_keyboard`,
    command_topic: `${root}/set`,
    state_topic: `${root}/state`,
    icon: "mdi:keyboard-close-outline",
    device: INTEGRATION.device,
  };
  if (!HARDWARE.support.keyboardVisibility) {
    removeConfig("switch", config);
    return;
  }
  publishConfig("switch", config)
    .on("message", (topic, message) => {
      if (topic === config.command_topic) {
        const status = message.toString();
        console.verbose("Set Keyboard Visibility:", status);
        hardware.setDisplayStatus("ON", () => {
          hardware.setKeyboardVisibility(status);
        });
      }
    })
    .subscribe(config.command_topic);
  updateKeyboard();
};

/**
 * Updates the keyboard visibility via the mqtt connection.
 */
const updateKeyboard = async () => {
  const visibility = hardware.getKeyboardVisibility();
  publishState("keyboard", visibility);
};

/**
 * Initializes the page number and handles the execute logic.
 */
const initPageNumber = () => {
  const root = `${INTEGRATION.root}/page_number`;
  const config = {
    name: "Page Number",
    unique_id: `${INTEGRATION.node}_page_number`,
    command_topic: `${root}/set`,
    state_topic: `${root}/state`,
    value_template: "{{ value | int }}",
    mode: "box",
    min: 1,
    max: WEBVIEW.viewUrls.length - 1,
    unit_of_measurement: "Page",
    icon: "mdi:page-next",
    device: INTEGRATION.device,
  };
  if (WEBVIEW.viewUrls.length <= 2) {
    removeConfig("number", config);
    return;
  }
  publishConfig("number", config)
    .on("message", (topic, message) => {
      if (topic === config.command_topic) {
        const number = parseInt(message, 10);
        if (WEBVIEW.viewActive && number) {
          console.verbose("Set Page Number:", number);
          WEBVIEW.viewActive = number;
          EVENTS.emit("updateView");
        }
      }
    })
    .subscribe(config.command_topic);
  updatePageNumber();
};

/**
 * Updates the page number via the mqtt connection.
 */
const updatePageNumber = async () => {
  const pageNumber = WEBVIEW.viewUrls.length <= 2 ? null : WEBVIEW.viewActive || 1;
  publishState("page_number", pageNumber);
};

/**
 * Initializes the page zoom and handles the execute logic.
 */
const initPageZoom = () => {
  const root = `${INTEGRATION.root}/page_zoom`;
  const config = {
    name: "Page Zoom",
    unique_id: `${INTEGRATION.node}_page_zoom`,
    command_topic: `${root}/set`,
    state_topic: `${root}/state`,
    value_template: "{{ value | int }}",
    mode: "box",
    min: 25,
    max: 400,
    step: 5,
    unit_of_measurement: "%",
    icon: "mdi:magnify-plus",
    device: INTEGRATION.device,
  };
  publishConfig("number", config)
    .on("message", (topic, message) => {
      if (topic === config.command_topic) {
        const zoom = parseInt(message, 10);
        if (WEBVIEW.viewActive && zoom) {
          console.verbose("Set Page Zoom:", zoom);
          WEBVIEW.zoom.set(zoom);
          EVENTS.emit("updateView");
        }
      }
    })
    .subscribe(config.command_topic);
  updatePageZoom();
};

/**
 * Updates the page zoom via the mqtt connection.
 */
const updatePageZoom = async () => {
  const pageZoom = WEBVIEW.zoom.get();
  publishState("page_zoom", pageZoom);
};

/**
 * Initializes the page url and handles the execute logic.
 */
const initPageUrl = () => {
  const root = `${INTEGRATION.root}/page_url`;
  const config = {
    name: "Page Url",
    unique_id: `${INTEGRATION.node}_page_url`,
    command_topic: `${root}/set`,
    state_topic: `${root}/state`,
    value_template: "{{ value }}",
    pattern: "https?://.*",
    icon: "mdi:web",
    device: INTEGRATION.device,
  };
  publishConfig("text", config)
    .on("message", (topic, message) => {
      if (topic === config.command_topic) {
        const url = message.toString();
        if (WEBVIEW.viewActive && url) {
          console.verbose("Set Page Url:", url);
          WEBVIEW.views[WEBVIEW.viewActive].webContents.loadURL(url);
        }
      }
    })
    .subscribe(config.command_topic);
  updatePageUrl();
};

/**
 * Updates the page url via the mqtt connection.
 */
const updatePageUrl = async () => {
  const defaultUrl = WEBVIEW.viewUrls[WEBVIEW.viewActive || 1];
  const currentUrl = WEBVIEW.views[WEBVIEW.viewActive || 1].webContents.getURL();
  const pageUrl = !currentUrl || currentUrl.startsWith("data:") ? defaultUrl : currentUrl;
  publishState("page_url", pageUrl.length < 255 ? pageUrl : null);
};

/**
 * Initializes the model sensor.
 */
const initModel = () => {
  const root = `${INTEGRATION.root}/model`;
  const config = {
    name: "Model",
    unique_id: `${INTEGRATION.node}_model`,
    state_topic: `${root}/state`,
    json_attributes_topic: `${root}/attributes`,
    value_template: "{{ value }}",
    icon: "mdi:raspberry-pi",
    device: INTEGRATION.device,
  };
  publishConfig("sensor", config);
  updateModel();
};

/**
 * Updates the model sensor via the mqtt connection.
 */
const updateModel = async () => {
  const model = hardware.getModel();
  publishState("model", model);
  publishAttributes("model", HARDWARE.support);
};

/**
 * Initializes the serial number sensor.
 */
const initSerialNumber = () => {
  const root = `${INTEGRATION.root}/serial_number`;
  const config = {
    name: "Serial Number",
    unique_id: `${INTEGRATION.node}_serial_number`,
    state_topic: `${root}/state`,
    value_template: "{{ value }}",
    icon: "mdi:hexadecimal",
    device: INTEGRATION.device,
  };
  publishConfig("sensor", config);
  updateSerialNumber();
};

/**
 * Updates the serial number sensor via the mqtt connection.
 */
const updateSerialNumber = async () => {
  const serialNumber = hardware.getSerialNumber();
  publishState("serial_number", serialNumber);
};

/**
 * Initializes the network address sensor.
 */
const initNetworkAddress = () => {
  const root = `${INTEGRATION.root}/network_address`;
  const config = {
    name: "Network Address",
    unique_id: `${INTEGRATION.node}_network_address`,
    state_topic: `${root}/state`,
    json_attributes_topic: `${root}/attributes`,
    value_template: "{{ value }}",
    icon: "mdi:ip-network",
    device: INTEGRATION.device,
  };
  publishConfig("sensor", config);
  updateNetworkAddress();
};

/**
 * Updates the network address sensor via the mqtt connection.
 */
const updateNetworkAddress = async () => {
  const networkAddresses = hardware.getNetworkAddresses();
  const [name] = Object.keys(networkAddresses);
  const [family] = name ? Object.keys(networkAddresses[name]) : [];
  const networkAddress = networkAddresses[name]?.[family]?.[0] || null;
  publishState("network_address", networkAddress);
  publishAttributes("network_address", networkAddresses);
};

/**
 * Initializes the host name sensor.
 */
const initHostName = () => {
  const root = `${INTEGRATION.root}/host_name`;
  const config = {
    name: "Host Name",
    unique_id: `${INTEGRATION.node}_host_name`,
    state_topic: `${root}/state`,
    value_template: "{{ value }}",
    icon: "mdi:console-network",
    device: INTEGRATION.device,
  };
  publishConfig("sensor", config);
  updateHostName();
};

/**
 * Updates the host name sensor via the mqtt connection.
 */
const updateHostName = async () => {
  const hostName = hardware.getHostName();
  publishState("host_name", hostName);
};

/**
 * Initializes the up time sensor.
 */
const initUpTime = () => {
  const root = `${INTEGRATION.root}/up_time`;
  const config = {
    name: "Up Time",
    unique_id: `${INTEGRATION.node}_up_time`,
    state_topic: `${root}/state`,
    json_attributes_topic: `${root}/attributes`,
    value_template: "{{ (value | float) | round(0) }}",
    unit_of_measurement: "min",
    icon: "mdi:timeline-clock",
    device: INTEGRATION.device,
  };
  publishConfig("sensor", config);
  updateUpTime();
};

/**
 * Updates the up time sensor via the mqtt connection.
 */
const updateUpTime = async () => {
  const upTime = hardware.getUpTime();
  const bootTime = {
    boot: new Date(new Date().getTime() - upTime * 60 * 1000),
  };
  publishState("up_time", upTime);
  publishAttributes("up_time", bootTime);
};

/**
 * Initializes the memory size sensor.
 */
const initMemorySize = () => {
  const root = `${INTEGRATION.root}/memory_size`;
  const config = {
    name: "Memory Size",
    unique_id: `${INTEGRATION.node}_memory_size`,
    state_topic: `${root}/state`,
    value_template: "{{ (value | float) | round(2) }}",
    unit_of_measurement: "GiB",
    icon: "mdi:memory",
    device: INTEGRATION.device,
  };
  publishConfig("sensor", config);
  updateMemorySize();
};

/**
 * Updates the memory size sensor via the mqtt connection.
 */
const updateMemorySize = async () => {
  const memorySize = hardware.getMemorySize();
  publishState("memory_size", memorySize);
};

/**
 * Initializes the memory usage sensor.
 */
const initMemoryUsage = () => {
  const root = `${INTEGRATION.root}/memory_usage`;
  const config = {
    name: "Memory Usage",
    unique_id: `${INTEGRATION.node}_memory_usage`,
    state_topic: `${root}/state`,
    value_template: "{{ (value | float) | round(0) }}",
    unit_of_measurement: "%",
    icon: "mdi:memory-arrow-down",
    device: INTEGRATION.device,
  };
  publishConfig("sensor", config);
  updateMemoryUsage();
};

/**
 * Updates the memory usage sensor via the mqtt connection.
 */
const updateMemoryUsage = async () => {
  const memoryUsage = hardware.getMemoryUsage();
  publishState("memory_usage", memoryUsage);
};

/**
 * Initializes the processor usage sensor.
 */
const initProcessorUsage = () => {
  const root = `${INTEGRATION.root}/processor_usage`;
  const config = {
    name: "Processor Usage",
    unique_id: `${INTEGRATION.node}_processor_usage`,
    state_topic: `${root}/state`,
    value_template: "{{ (value | float) | round(0) }}",
    unit_of_measurement: "%",
    icon: "mdi:cpu-64-bit",
    device: INTEGRATION.device,
  };
  publishConfig("sensor", config);
  updateProcessorUsage();
};

/**
 * Updates the processor usage sensor via the mqtt connection.
 */
const updateProcessorUsage = async () => {
  const processorUsage = hardware.getProcessorUsage();
  publishState("processor_usage", processorUsage);
};

/**
 * Initializes the processor temperature sensor.
 */
const initProcessorTemperature = () => {
  const root = `${INTEGRATION.root}/processor_temperature`;
  const config = {
    name: "Processor Temperature",
    unique_id: `${INTEGRATION.node}_processor_temperature`,
    state_topic: `${root}/state`,
    value_template: "{{ (value | float) | round(0) }}",
    unit_of_measurement: "°C",
    icon: "mdi:radiator",
    device: INTEGRATION.device,
  };
  publishConfig("sensor", config);
  updateProcessorTemperature();
};

/**
 * Updates the processor temperature sensor via the mqtt connection.
 */
const updateProcessorTemperature = async () => {
  const processorTemperature = hardware.getProcessorTemperature();
  publishState("processor_temperature", processorTemperature);
};

/**
 * Initializes the battery level sensor.
 */
const initBatteryLevel = () => {
  const root = `${INTEGRATION.root}/battery_level`;
  const config = {
    name: "Battery Level",
    unique_id: `${INTEGRATION.node}_battery_level`,
    state_topic: `${root}/state`,
    value_template: "{{ (value | float) | round(0) }}",
    unit_of_measurement: "%",
    icon: "mdi:battery-medium",
    device: INTEGRATION.device,
  };
  if (!HARDWARE.support.batteryLevel) {
    removeConfig("sensor", config);
    return;
  }
  publishConfig("sensor", config);
  updateBatteryLevel();
};

/**
 * Updates the battery level sensor via the mqtt connection.
 */
const updateBatteryLevel = async () => {
  const batteryLevel = hardware.getBatteryLevel();
  publishState("battery_level", batteryLevel);
};

/**
 * Initializes the package upgrades sensor.
 */
const initPackageUpgrades = () => {
  const root = `${INTEGRATION.root}/package_upgrades`;
  const config = {
    name: "Package Upgrades",
    unique_id: `${INTEGRATION.node}_package_upgrades`,
    state_topic: `${root}/state`,
    json_attributes_topic: `${root}/attributes`,
    value_template: "{{ value | int }}",
    icon: "mdi:package-down",
    device: INTEGRATION.device,
  };
  publishConfig("sensor", config);
  updatePackageUpgrades();
};

/**
 * Updates the package upgrades sensor via the mqtt connection.
 */
const updatePackageUpgrades = async () => {
  const packages = hardware.checkPackageUpgrades();
  const upgrades = {
    packages: packages.map((pkg) => {
      const [name, version] = pkg.replace(/\s*\[.*?\]\s*/g, "").split(/\s+/, 2);
      return { [name]: version };
    }),
  };
  publishState("package_upgrades", packages.length);
  publishAttributes("package_upgrades", upgrades);
};

/**
 * Initializes the last active sensor.
 */
const initLastActive = () => {
  const root = `${INTEGRATION.root}/last_active`;
  const config = {
    name: "Last Active",
    unique_id: `${INTEGRATION.node}_last_active`,
    state_topic: `${root}/state`,
    json_attributes_topic: `${root}/attributes`,
    value_template: "{{ (value | float) | round(0) }}",
    unit_of_measurement: "min",
    icon: "mdi:gesture-tap-hold",
    device: INTEGRATION.device,
  };
  publishConfig("sensor", config);
  updateLastActive();
};

/**
 * Updates the last active sensor via the mqtt connection.
 */
const updateLastActive = async () => {
  const now = new Date();
  const then = WEBVIEW.tracker.pointer.time;
  const lastActive = (now - then) / (1000 * 60);
  const tracker = {
    ...WEBVIEW.tracker.pointer.position,
    ...WEBVIEW.tracker.display,
  };
  publishState("last_active", lastActive);
  publishAttributes("last_active", tracker);
};

/**
 * Initializes the motion binary sensor.
 */
const initMotion = () => {
  const root = `${INTEGRATION.root}/motion`;
  const config = {
    name: "Motion",
    unique_id: `${INTEGRATION.node}_motion`,
    state_topic: `${root}/state`,
    payload_on: "ON",
    payload_off: "OFF",
    device_class: "motion",
    icon: "mdi:motion-sensor",
    device: INTEGRATION.device,
  };
  publishConfig("binary_sensor", config);
  updateMotion();
};

/**
 * Updates the motion binary sensor via the mqtt connection.
 */
const updateMotion = async (detected = false) => {
  // Clear existing timer
  if (WEBVIEW.tracker.motion.clearTimer) {
    clearTimeout(WEBVIEW.tracker.motion.clearTimer);
    WEBVIEW.tracker.motion.clearTimer = null;
  }
  
  // Determine motion state
  let isMotion = false;
  if (detected) {
    isMotion = true;
    // Set new timer to clear motion after 5 seconds
    WEBVIEW.tracker.motion.clearTimer = setTimeout(() => {
      updateMotion(false);
    }, 5000);
  }
  
  // Only publish if state changed
  if (WEBVIEW.tracker.motion.detected !== isMotion) {
    WEBVIEW.tracker.motion.detected = isMotion;
    publishState("motion", isMotion ? "ON" : "OFF");
  }
};

/**
 * Initializes the page screenshot.
 */
const initScreenshot = () => {
  const root = `${INTEGRATION.root}/screenshot`;
  const config = {
    name: "Screenshot",
    unique_id: `${INTEGRATION.node}_screenshot`,
    image_topic: `${root}/state`,
    image_encoding: "b64",
    content_type: "image/png",
    entity_category: "diagnostic",
    icon: "mdi:image-area",
    device: INTEGRATION.device,
  };
  publishConfig("image", config);
  updateScreenshot();
};

/**
 * Updates the page screenshot via the mqtt connection.
 */
const updateScreenshot = async () => {
  const screenshot = WEBVIEW.tracker.screenshot;
  publishState("screenshot", screenshot);
};

/**
 * Initializes the heartbeat sensor.
 */
const initHeartbeat = () => {
  const root = `${INTEGRATION.root}/heartbeat`;
  const config = {
    name: "Heartbeat",
    unique_id: `${INTEGRATION.node}_heartbeat`,
    state_topic: `${root}/state`,
    json_attributes_topic: `${root}/attributes`,
    value_template: "{{ value }}",
    entity_category: "diagnostic",
    icon: "mdi:heart-flash",
    device: INTEGRATION.device,
  };
  publishConfig("sensor", config);
  updateHeartbeat();
};

/**
 * Updates the heartbeat sensor via the mqtt connection.
 */
const updateHeartbeat = async () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000);
  const heartbeat = local.toISOString().replace(/\.\d{3}Z$/, "");
  const attributes = { date: now };
  publishState("heartbeat", heartbeat);
  publishAttributes("heartbeat", attributes);
};

/**
 * Initializes the error log sensor.
 */
const initErrors = () => {
  const root = `${INTEGRATION.root}/errors`;
  const config = {
    name: "Errors",
    unique_id: `${INTEGRATION.node}_errors`,
    state_topic: `${root}/state`,
    json_attributes_topic: `${root}/attributes`,
    value_template: "{{ value | int }}",
    entity_category: "diagnostic",
    icon: "mdi:alert-circle",
    device: INTEGRATION.device,
  };
  publishConfig("sensor", config);
  updateErrors();
};

/**
 * Updates the error log sensor via the mqtt connection.
 */
const updateErrors = async () => {
  const logs = APP.logs.slice().reverse();
  const errors = logs.filter((log) => log.level === "error");
  const history = logs.reduce((acc, log) => {
    const time = log.time.toISOString().slice(0, 16);
    if (!acc[time]) {
      acc[time] = [];
    }
    acc[time].push({ [log.level.toUpperCase()]: log.text });
    return acc;
  }, {});
  publishState("errors", errors.length);
  publishAttributes("errors", history);
};

/**
 * Initializes the version sensor.
 */
const initVersion = () => {
  const root = `${INTEGRATION.root}/version`;
  const config = {
    name: "Version",
    unique_id: `${INTEGRATION.node}_version`,
    state_topic: `${root}/state`,
    json_attributes_topic: `${root}/attributes`,
    value_template: "{{ value }}",
    entity_category: "diagnostic",
    icon: "mdi:application-braces",
    device: INTEGRATION.device,
  };
  publishConfig("sensor", config);
  updateVersion();
};

/**
 * Updates the version sensor via the mqtt connection.
 */
const updateVersion = async () => {
  publishState("version", APP.version);
  publishAttributes("version", APP.build);
};

module.exports = {
  init,
  update,
};
