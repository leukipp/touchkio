const mqtt = require("mqtt");
const hardware = require("./hardware");
const { app } = require("electron");
const Events = require("events");

global.INTEGRATION = global.INTEGRATION || {
  initialized: false,
  events: new Events(),
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
  INTEGRATION.root = `${app.getName()}/${INTEGRATION.node}`;
  INTEGRATION.device = {
    name: `TouchKio ${deviceName}`,
    model: model,
    manufacturer: vendor,
    serial_number: serialNumber,
    identifiers: [INTEGRATION.node],
    sw_version: `${app.getName()}-v${app.getVersion()}`,
  };

  // Connection settings
  const options = user === null || password === null ? null : { username: user, password: password };
  const masked = password === null ? "null" : "*".repeat(password.length);
  console.log("MQTT Connecting:", `${user}:${masked}@${url.toString()}`);
  INTEGRATION.client = mqtt.connect(url.toString(), options);

  // Client connected
  INTEGRATION.client
    .on("connect", () => {
      console.log(`MQTT Connected: ${url.toString()}\n`);

      // Init client controls
      initShutdown();
      initReboot();
      initRefresh();
      initKiosk();
      initDisplay();
      initKeyboard();
      initPageNumber();
      initPageZoom();
      initPageUrl();

      // Init client sensors
      initModel();
      initSerialNumber();
      initHostName();
      initUpTime();
      initMemorySize();
      initMemoryUsage();
      initProcessorUsage();
      initProcessorTemperature();
      initBatteryLevel();
      initPackageUpgrades();
      initHeartbeat();
      initLastActive();

      // Integration initialized
      INTEGRATION.initialized = true;
    })
    .on("error", (error) => {
      console.error("MQTT:", error);
    });

  // Update sensor states from events
  HARDWARE.events.on("updateDisplay", updateDisplay);
  HARDWARE.events.on("updateKeyboard", updateKeyboard);

  // Update time sensors periodically (30s)
  setInterval(() => {
    updateHeartbeat();
    updateLastActive();
  }, 30 * 1000);

  // Update system sensors periodically (1min)
  setInterval(() => {
    update();
  }, 60 * 1000);

  // Update package sensors periodically (60min)
  setInterval(() => {
    updatePackageUpgrades();
  }, 3600 * 1000);

  return true;
};

/**
 * Updates the shared integration properties.
 */
const update = async () => {
  if (!INTEGRATION.initialized) {
    return;
  }

  // Update client sensors
  updateKiosk();
  updatePageNumber();
  updatePageZoom();
  updatePageUrl();
  updateUpTime();
  updateLastActive();
  updateMemoryUsage();
  updateProcessorUsage();
  updateProcessorTemperature();
  updateBatteryLevel();
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
  publishConfig("button", config)
    .on("message", (topic, message) => {
      if (topic === config.command_topic) {
        console.log("Shutdown system...");
        hardware.setDisplayStatus("ON");
        hardware.shutdownSystem();
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
  publishConfig("button", config)
    .on("message", (topic, message) => {
      if (topic === config.command_topic) {
        console.log("Rebooting system...");
        hardware.setDisplayStatus("ON");
        hardware.rebootSystem();
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
        console.log("Refreshing webview...");
        hardware.setDisplayStatus("ON");
        WEBVIEW.events.emit("reloadView");
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
        console.log("Set Kiosk Status:", status);
        hardware.setDisplayStatus("ON");
        switch (status) {
          case "Framed":
            WEBVIEW.window.restore();
            WEBVIEW.window.unmaximize();
            WEBVIEW.window.setFullScreen(false);
            break;
          case "Fullscreen":
            WEBVIEW.window.restore();
            WEBVIEW.window.unmaximize();
            WEBVIEW.window.setFullScreen(true);
            break;
          case "Maximized":
            WEBVIEW.window.restore();
            WEBVIEW.window.setFullScreen(false);
            WEBVIEW.window.maximize();
            break;
          case "Minimized":
            WEBVIEW.window.restore();
            WEBVIEW.window.setFullScreen(false);
            WEBVIEW.window.minimize();
            break;
          case "Terminated":
            app.quit();
        }
      }
    })
    .subscribe(config.command_topic);
  updateKiosk();
};

/**
 * Updates the kiosk status via the mqtt connection.
 */
const updateKiosk = () => {
  const kiosk = WEBVIEW.status;
  publishState("kiosk", kiosk);
};

/**
 * Initializes the display status, brightness and handles the execute logic.
 */
const initDisplay = () => {
  if (!HARDWARE.support.displayStatus) {
    return;
  }
  const root = `${INTEGRATION.root}/display`;
  const config = {
    name: "Display",
    unique_id: `${INTEGRATION.node}_display`,
    command_topic: `${root}/power/set`,
    state_topic: `${root}/power/state`,
    icon: "mdi:monitor-shimmer",
    platform: "light",
    device: INTEGRATION.device,
    ...(HARDWARE.support.displayBrightness && {
      brightness_command_topic: `${root}/brightness/set`,
      brightness_state_topic: `${root}/brightness/state`,
      brightness_scale: 100,
    }),
  };
  publishConfig("light", config)
    .on("message", (topic, message) => {
      if (topic === config.command_topic) {
        const status = message.toString();
        console.log("Set Display Status:", status);
        hardware.setDisplayStatus(status, (reply, error) => {
          if (error) {
            console.warn("Failed:", error);
          } else {
            hardware.update();
          }
        });
      } else if (topic === config.brightness_command_topic) {
        const brightness = parseInt(message, 10);
        console.log("Set Display Brightness:", brightness);
        hardware.setDisplayBrightness(brightness, (reply, error) => {
          if (error) {
            console.warn("Failed:", error);
          } else {
            hardware.update();
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
const updateDisplay = () => {
  const status = hardware.getDisplayStatus();
  const brightness = hardware.getDisplayBrightness();
  publishState("display/power", status);
  publishState("display/brightness", brightness);
};

/**
 * Initializes the keyboard visibility and handles the execute logic.
 */
const initKeyboard = () => {
  if (!HARDWARE.support.keyboardVisibility) {
    return;
  }
  const root = `${INTEGRATION.root}/keyboard`;
  const config = {
    name: "Keyboard",
    unique_id: `${INTEGRATION.node}_keyboard`,
    command_topic: `${root}/set`,
    state_topic: `${root}/state`,
    icon: "mdi:keyboard-close-outline",
    device: INTEGRATION.device,
  };
  publishConfig("switch", config)
    .on("message", (topic, message) => {
      if (topic === config.command_topic) {
        const status = message.toString();
        console.log("Set Keyboard Visibility:", status);
        hardware.setKeyboardVisibility(status);
        switch (status) {
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
      }
    })
    .subscribe(config.command_topic);
  updateKeyboard();
};

/**
 * Updates the keyboard visibility via the mqtt connection.
 */
const updateKeyboard = () => {
  const visibility = hardware.getKeyboardVisibility();
  publishState("keyboard", visibility);
};

/**
 * Initializes the page number and handles the execute logic.
 */
const initPageNumber = () => {
  if (WEBVIEW.viewUrls.length < 3) {
    return;
  }
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
  publishConfig("number", config)
    .on("message", (topic, message) => {
      if (topic === config.command_topic) {
        const number = parseInt(message, 10);
        console.log("Set Page Number:", number);
        WEBVIEW.viewActive = number || 1;
        WEBVIEW.events.emit("updateView");
      }
    })
    .subscribe(config.command_topic);
  updatePageNumber();
};

/**
 * Updates the page number via the mqtt connection.
 */
const updatePageNumber = () => {
  const pageNumber = WEBVIEW.viewActive || 1;
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
    mode: "slider",
    min: 5,
    max: 500,
    unit_of_measurement: "%",
    icon: "mdi:magnify-plus-outline",
    device: INTEGRATION.device,
  };
  publishConfig("number", config)
    .on("message", (topic, message) => {
      if (topic === config.command_topic) {
        const zoom = parseInt(message, 10);
        console.log("Set Page Zoom:", zoom);
        WEBVIEW.views[WEBVIEW.viewActive || 1].webContents.setZoomFactor(zoom / 100.0);
        WEBVIEW.events.emit("updateView");
      }
    })
    .subscribe(config.command_topic);
  updatePageZoom();
};

/**
 * Updates the page zoom via the mqtt connection.
 */
const updatePageZoom = () => {
  const pageZoom = Math.round(WEBVIEW.views[WEBVIEW.viewActive || 1].webContents.getZoomFactor() * 100.0);
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
        console.log("Set Page Url:", url);
        WEBVIEW.views[WEBVIEW.viewActive || 1].webContents.loadURL(url);
      }
    })
    .subscribe(config.command_topic);
  updatePageUrl();
};

/**
 * Updates the page url via the mqtt connection.
 */
const updatePageUrl = () => {
  const defaultUrl = WEBVIEW.viewUrls[WEBVIEW.viewActive || 1];
  const currentUrl = WEBVIEW.views[WEBVIEW.viewActive || 1].webContents.getURL();
  const pageUrl = !currentUrl || currentUrl.startsWith("data:") ? defaultUrl : currentUrl;
  publishState("page_url", pageUrl);
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
const updateModel = () => {
  const model = hardware.getModel();
  publishState("model", model);
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
const updateSerialNumber = () => {
  const serialNumber = hardware.getSerialNumber();
  publishState("serial_number", serialNumber);
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
const updateHostName = () => {
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
const updateUpTime = () => {
  const upTime = hardware.getUpTime();
  publishState("up_time", upTime);
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
const updateMemorySize = () => {
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
const updateMemoryUsage = () => {
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
const updateProcessorUsage = () => {
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
const updateProcessorTemperature = () => {
  const processorTemperature = hardware.getProcessorTemperature();
  publishState("processor_temperature", processorTemperature);
};

/**
 * Initializes the battery level sensor.
 */
const initBatteryLevel = () => {
  if (!HARDWARE.support.batteryLevel) {
    return;
  }
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
  publishConfig("sensor", config);
  updateBatteryLevel();
};

/**
 * Updates the battery level sensor via the mqtt connection.
 */
const updateBatteryLevel = () => {
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
const updatePackageUpgrades = () => {
  const packages = hardware.checkPackageUpgrades();
  const attributes = {
    total: packages.length,
    packages: packages.map((pkg) => pkg.replace(/\s*\[.*?\]\s*/g, "").trim()),
  };
  publishAttributes("package_upgrades", attributes);
  publishState("package_upgrades", attributes.total);
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
    value_template: "{{ value }}",
    icon: "mdi:heart-flash",
    device: INTEGRATION.device,
  };
  publishConfig("sensor", config);
  updateHeartbeat();
};

/**
 * Updates the heartbeat sensor via the mqtt connection.
 */
const updateHeartbeat = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000);
  const heartbeat = local.toISOString().replace(/\.\d{3}Z$/, "");
  publishState("heartbeat", heartbeat);
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
const updateLastActive = () => {
  const now = new Date();
  const then = WEBVIEW.pointer.time;
  const lastActive = Math.abs(now - then) / (1000 * 60);
  publishState("last_active", lastActive);
};

module.exports = {
  init,
  update,
};
