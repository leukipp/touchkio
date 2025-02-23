const mqtt = require("mqtt");
const hardware = require("./hardware");
const { app } = require("electron");

global.INTEGRATION = global.INTEGRATION || {
  initialized: false,
  status: null,
};

/**
 * Initializes the integration with the provided arguments.
 *
 * @returns {boolean} Returns true if the initialization was successful.
 */
const init = async () => {
  if (!ARGS.mqtt_url) {
    return false;
  }
  if (!/^mqtts?:\/\//.test(ARGS.mqtt_url)) {
    console.error("Please provide the '--mqtt-url' parameter with mqtt(s)");
    return app.quit();
  }
  const url = new URL(ARGS.mqtt_url);
  const user = ARGS.mqtt_user ? ARGS.mqtt_user : null;
  const password = ARGS.mqtt_password ? ARGS.mqtt_password : null;
  const discovery = ARGS.mqtt_discovery ? ARGS.mqtt_discovery : "homeassistant";

  const model = hardware.getModel();
  const vendor = hardware.getVendor();
  const hostName = hardware.getHostName();
  const serialNumber = hardware.getSerialNumber();
  const serialNumberSuffix = serialNumber.slice(-6);

  const deviceId = serialNumberSuffix.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const deviceName = hostName.charAt(0).toUpperCase() + hostName.slice(1);

  // Init globals
  INTEGRATION.node = `rpi_${deviceId}`;
  INTEGRATION.discovery = discovery;
  INTEGRATION.device = {
    name: `TouchKio ${deviceName}`,
    model: model,
    manufacturer: vendor,
    serial_number: serialNumber,
    identifiers: [INTEGRATION.node],
    sw_version: `${app.getName()}-v${app.getVersion()}`,
  };

  // Connection settings
  const options = user === null || password == null ? null : { username: user, password: password };
  const masked = password === null ? "null" : "*".repeat(password.length);
  console.log("MQTT Connecting:", `${user}:${masked}@${url.toString()}`);
  INTEGRATION.client = mqtt.connect(url.toString(), options);

  // Client connected
  INTEGRATION.client
    .on("connect", () => {
      console.log(`MQTT Connected: ${url.toString()}\n`);

      // Init client controls
      initShutdown(INTEGRATION.client);
      initReboot(INTEGRATION.client);
      initRefresh(INTEGRATION.client);
      initKiosk(INTEGRATION.client);
      initDisplay(INTEGRATION.client);
      initKeyboard(INTEGRATION.client);

      // Init client sensors
      initModel(INTEGRATION.client);
      initSerialNumber(INTEGRATION.client);
      initHostName(INTEGRATION.client);
      initUpTime(INTEGRATION.client);
      initMemorySize(INTEGRATION.client);
      initMemoryUsage(INTEGRATION.client);
      initProcessorUsage(INTEGRATION.client);
      initProcessorTemperature(INTEGRATION.client);
      initPackageUpgrades(INTEGRATION.client);
      initHeartbeat(INTEGRATION.client);
      initLastActive(INTEGRATION.client);

      // Integration initialized
      INTEGRATION.initialized = true;
      INTEGRATION.status = "Online";
    })
    .on("error", (error) => {
      console.error("MQTT:", error);
      INTEGRATION.status = "Offline";
    });

  // Update sensor states from notifiers
  HARDWARE.display.notifiers.push(() => {
    updateDisplay(INTEGRATION.client);
  });
  HARDWARE.keyboard.notifiers.push(() => {
    updateKeyboard(INTEGRATION.client);
  });

  // Update time sensors periodically (30s)
  setInterval(() => {
    updateHeartbeat(INTEGRATION.client);
    updateLastActive(INTEGRATION.client);
  }, 30 * 1000);

  // Update system sensors periodically (1min)
  setInterval(() => {
    update();
  }, 60 * 1000);

  // Update package sensors periodically (60min)
  setInterval(() => {
    updatePackageUpgrades(INTEGRATION.client);
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
  updateKiosk(INTEGRATION.client);
  updateUpTime(INTEGRATION.client);
  updateLastActive(INTEGRATION.client);
  updateMemoryUsage(INTEGRATION.client);
  updateProcessorUsage(INTEGRATION.client);
  updateProcessorTemperature(INTEGRATION.client);
};

/**
 * Initializes the shutdown button and handles the execute logic.
 *
 * @param {Object} client - Instance of the mqtt client.
 */
const initShutdown = (client) => {
  const root = `${INTEGRATION.discovery}/button/${INTEGRATION.node}/shutdown`;
  const config = {
    name: "Shutdown",
    unique_id: `${INTEGRATION.node}_shutdown`,
    command_topic: `${root}/execute`,
    icon: "mdi:power",
    device: INTEGRATION.device,
  };
  client
    .publish(`${root}/config`, JSON.stringify(config), { qos: 1, retain: true })
    .on("message", (topic, message) => {
      if (topic === `${root}/execute`) {
        console.log("Shutdown system...");
        hardware.setDisplayStatus("ON");
        hardware.shutdownSystem();
      }
    })
    .subscribe(`${root}/execute`);
};

/**
 * Initializes the reboot button and handles the execute logic.
 *
 * @param {Object} client - Instance of the mqtt client.
 */
const initReboot = (client) => {
  const root = `${INTEGRATION.discovery}/button/${INTEGRATION.node}/reboot`;
  const config = {
    name: "Reboot",
    unique_id: `${INTEGRATION.node}_reboot`,
    command_topic: `${root}/execute`,
    icon: "mdi:restart",
    device: INTEGRATION.device,
  };
  client
    .publish(`${root}/config`, JSON.stringify(config), { qos: 1, retain: true })
    .on("message", (topic, message) => {
      if (topic === `${root}/execute`) {
        console.log("Rebooting system...");
        hardware.setDisplayStatus("ON");
        hardware.rebootSystem();
      }
    })
    .subscribe(`${root}/execute`);
};

/**
 * Initializes the refresh button and handles the execute logic.
 *
 * @param {Object} client - Instance of the mqtt client.
 */
const initRefresh = (client) => {
  const root = `${INTEGRATION.discovery}/button/${INTEGRATION.node}/refresh`;
  const config = {
    name: "Refresh",
    unique_id: `${INTEGRATION.node}_refresh`,
    command_topic: `${root}/execute`,
    icon: "mdi:web-refresh",
    device: INTEGRATION.device,
  };
  client
    .publish(`${root}/config`, JSON.stringify(config), { qos: 1, retain: true })
    .on("message", (topic, message) => {
      if (topic === `${root}/execute`) {
        console.log("Refreshing webview...");
        hardware.setDisplayStatus("ON");
        WEBVIEW.view.webContents.reloadIgnoringCache();
      }
    })
    .subscribe(`${root}/execute`);
};

/**
 * Initializes the kiosk select status and handles the execute logic.
 *
 * @param {Object} client - Instance of the mqtt client.
 */
const initKiosk = (client) => {
  const root = `${INTEGRATION.discovery}/select/${INTEGRATION.node}/kiosk`;
  const config = {
    name: `Kiosk`,
    unique_id: `${INTEGRATION.node}_kiosk`,
    command_topic: `${root}/set`,
    state_topic: `${root}/status`,
    value_template: "{{ value }}",
    options: ["Framed", "Fullscreen", "Maximized", "Minimized", "Terminated"],
    icon: "mdi:overscan",
    device: INTEGRATION.device,
  };
  client
    .publish(`${root}/config`, JSON.stringify(config), { qos: 1, retain: true })
    .on("message", (topic, message) => {
      if (topic === `${root}/set`) {
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
    .subscribe(`${root}/set`);
  updateKiosk(client);
};

/**
 * Updates the kiosk status via the mqtt connection.
 *
 * @param {Object} client - Instance of the mqtt client.
 */
const updateKiosk = (client) => {
  const kiosk = WEBVIEW.status;
  const root = `${INTEGRATION.discovery}/select/${INTEGRATION.node}/kiosk`;
  if (kiosk !== null) {
    client.publish(`${root}/status`, `${kiosk}`, { qos: 1, retain: true });
  }
};

/**
 * Initializes the display status, brightness and handles the execute logic.
 *
 * @param {Object} client - Instance of the mqtt client.
 */
const initDisplay = (client) => {
  if (!HARDWARE.support.displayStatus) {
    return;
  }
  const root = `${INTEGRATION.discovery}/light/${INTEGRATION.node}/display`;
  const config = {
    name: `Display`,
    unique_id: `${INTEGRATION.node}_display`,
    command_topic: `${root}/set`,
    state_topic: `${root}/status`,
    icon: "mdi:monitor-shimmer",
    platform: "light",
    device: INTEGRATION.device,
  };
  if (HARDWARE.support.displayBrightness) {
    config.brightness_scale = 100;
    config.brightness_command_topic = `${root}/brightness/set`;
    config.brightness_state_topic = `${root}/brightness/status`;
  }
  client
    .publish(`${root}/config`, JSON.stringify(config), { qos: 1, retain: true })
    .on("message", (topic, message) => {
      if (topic === `${root}/set`) {
        const status = message.toString();
        console.log("Set Display Status:", status);
        hardware.setDisplayStatus(status);
        hardware.update();
      } else if (topic === `${root}/brightness/set`) {
        const brightness = parseInt(message, 10);
        console.log("Set Display Brightness:", brightness);
        hardware.setDisplayBrightness(brightness);
        hardware.update();
      }
    })
    .subscribe(`${root}/set`)
    .subscribe(`${root}/brightness/set`);
  updateDisplay(client);
};

/**
 * Updates the display status, brightness via the mqtt connection.
 *
 * @param {Object} client - Instance of the mqtt client.
 */
const updateDisplay = (client) => {
  const status = hardware.getDisplayStatus();
  const brightness = hardware.getDisplayBrightness();
  const root = `${INTEGRATION.discovery}/light/${INTEGRATION.node}/display`;
  if (status !== null) {
    client.publish(`${root}/status`, `${status}`, { qos: 1, retain: true });
  }
  if (brightness !== null) {
    client.publish(`${root}/brightness/status`, `${brightness}`, { qos: 1, retain: true });
  }
};

/**
 * Initializes the keyboard visibility and handles the execute logic.
 *
 * @param {Object} client - Instance of the mqtt client.
 */
const initKeyboard = (client) => {
  if (!HARDWARE.support.keyboardVisibility) {
    return;
  }
  const root = `${INTEGRATION.discovery}/switch/${INTEGRATION.node}/keyboard`;
  const config = {
    name: `Keyboard`,
    unique_id: `${INTEGRATION.node}_keyboard`,
    command_topic: `${root}/set`,
    state_topic: `${root}/status`,
    icon: "mdi:keyboard-close-outline",
    device: INTEGRATION.device,
  };
  client
    .publish(`${root}/config`, JSON.stringify(config), { qos: 1, retain: true })
    .on("message", (topic, message) => {
      if (topic === `${root}/set`) {
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
    .subscribe(`${root}/set`);
  updateKeyboard(client);
};

/**
 * Updates the keyboard visibility via the mqtt connection.
 *
 * @param {Object} client - Instance of the mqtt client.
 */
const updateKeyboard = (client) => {
  const visibility = hardware.getKeyboardVisibility();
  const root = `${INTEGRATION.discovery}/switch/${INTEGRATION.node}/keyboard`;
  if (visibility !== null) {
    client.publish(`${root}/status`, `${visibility}`, { qos: 1, retain: true });
  }
};

/**
 * Initializes the model sensor.
 *
 * @param {Object} client - Instance of the mqtt client.
 */
const initModel = (client) => {
  const root = `${INTEGRATION.discovery}/sensor/${INTEGRATION.node}/model`;
  const config = {
    name: `Model`,
    unique_id: `${INTEGRATION.node}_model`,
    state_topic: `${root}/status`,
    value_template: "{{ value }}",
    icon: "mdi:raspberry-pi",
    device: INTEGRATION.device,
  };
  client.publish(`${root}/config`, JSON.stringify(config), { qos: 1, retain: true });
  updateModel(client);
};

/**
 * Updates the model sensor via the mqtt connection.
 *
 * @param {Object} client - Instance of the mqtt client.
 */
const updateModel = (client) => {
  const model = hardware.getModel();
  const root = `${INTEGRATION.discovery}/sensor/${INTEGRATION.node}/model`;
  if (model !== null) {
    client.publish(`${root}/status`, `${model}`, { qos: 1, retain: true });
  }
};

/**
 * Initializes the serial number sensor.
 *
 * @param {Object} client - Instance of the mqtt client.
 */
const initSerialNumber = (client) => {
  const root = `${INTEGRATION.discovery}/sensor/${INTEGRATION.node}/serial_number`;
  const config = {
    name: `Serial Number`,
    unique_id: `${INTEGRATION.node}_serial_number`,
    state_topic: `${root}/status`,
    value_template: "{{ value }}",
    icon: "mdi:hexadecimal",
    device: INTEGRATION.device,
  };
  client.publish(`${root}/config`, JSON.stringify(config), { qos: 1, retain: true });
  updateSerialNumber(client);
};

/**
 * Updates the serial number sensor via the mqtt connection.
 *
 * @param {Object} client - Instance of the mqtt client.
 */
const updateSerialNumber = (client) => {
  const serialNumber = hardware.getSerialNumber();
  const root = `${INTEGRATION.discovery}/sensor/${INTEGRATION.node}/serial_number`;
  if (serialNumber !== null) {
    client.publish(`${root}/status`, `${serialNumber}`, { qos: 1, retain: true });
  }
};

/**
 * Initializes the host name sensor.
 *
 * @param {Object} client - Instance of the mqtt client.
 */
const initHostName = (client) => {
  const root = `${INTEGRATION.discovery}/sensor/${INTEGRATION.node}/host_name`;
  const config = {
    name: `Host Name`,
    unique_id: `${INTEGRATION.node}_host_name`,
    state_topic: `${root}/status`,
    value_template: "{{ value }}",
    icon: "mdi:console-network",
    device: INTEGRATION.device,
  };
  client.publish(`${root}/config`, JSON.stringify(config), { qos: 1, retain: true });
  updateHostName(client);
};

/**
 * Updates the host name sensor via the mqtt connection.
 *
 * @param {Object} client - Instance of the mqtt client.
 */
const updateHostName = (client) => {
  const hostName = hardware.getHostName();
  const root = `${INTEGRATION.discovery}/sensor/${INTEGRATION.node}/host_name`;
  if (hostName !== null) {
    client.publish(`${root}/status`, `${hostName}`, { qos: 1, retain: true });
  }
};

/**
 * Initializes the up time sensor.
 *
 * @param {Object} client - Instance of the mqtt client.
 */
const initUpTime = (client) => {
  const root = `${INTEGRATION.discovery}/sensor/${INTEGRATION.node}/up_time`;
  const config = {
    name: `Up Time`,
    unique_id: `${INTEGRATION.node}_up_time`,
    state_topic: `${root}/status`,
    value_template: "{{ (value | float) | round(0) }}",
    unit_of_measurement: "min",
    icon: "mdi:timeline-clock",
    device: INTEGRATION.device,
  };
  client.publish(`${root}/config`, JSON.stringify(config), { qos: 1, retain: true });
  updateUpTime(client);
};

/**
 * Updates the up time sensor via the mqtt connection.
 *
 * @param {Object} client - Instance of the mqtt client.
 */
const updateUpTime = (client) => {
  const upTime = hardware.getUpTime();
  const root = `${INTEGRATION.discovery}/sensor/${INTEGRATION.node}/up_time`;
  if (upTime !== null) {
    client.publish(`${root}/status`, `${upTime}`, { qos: 1, retain: true });
  }
};

/**
 * Initializes the memory size sensor.
 *
 * @param {Object} client - Instance of the mqtt client.
 */
const initMemorySize = (client) => {
  const root = `${INTEGRATION.discovery}/sensor/${INTEGRATION.node}/memory_size`;
  const config = {
    name: `Memory Size`,
    unique_id: `${INTEGRATION.node}_memory_size`,
    state_topic: `${root}/status`,
    value_template: "{{ (value | float) | round(2) }}",
    unit_of_measurement: "GiB",
    icon: "mdi:memory",
    device: INTEGRATION.device,
  };
  client.publish(`${root}/config`, JSON.stringify(config), { qos: 1, retain: true });
  updateMemorySize(client);
};

/**
 * Updates the memory size sensor via the mqtt connection.
 *
 * @param {Object} client - Instance of the mqtt client.
 */
const updateMemorySize = (client) => {
  const memorySize = hardware.getMemorySize();
  const root = `${INTEGRATION.discovery}/sensor/${INTEGRATION.node}/memory_size`;
  if (memorySize !== null) {
    client.publish(`${root}/status`, `${memorySize}`, { qos: 1, retain: true });
  }
};

/**
 * Initializes the memory usage sensor.
 *
 * @param {Object} client - Instance of the mqtt client.
 */
const initMemoryUsage = (client) => {
  const root = `${INTEGRATION.discovery}/sensor/${INTEGRATION.node}/memory_usage`;
  const config = {
    name: `Memory Usage`,
    unique_id: `${INTEGRATION.node}_memory_usage`,
    state_topic: `${root}/status`,
    value_template: "{{ (value | float) | round(0) }}",
    unit_of_measurement: "%",
    icon: "mdi:memory-arrow-down",
    device: INTEGRATION.device,
  };
  client.publish(`${root}/config`, JSON.stringify(config), { qos: 1, retain: true });
  updateMemoryUsage(client);
};

/**
 * Updates the memory usage sensor via the mqtt connection.
 *
 * @param {Object} client - Instance of the mqtt client.
 */
const updateMemoryUsage = (client) => {
  const memoryUsage = hardware.getMemoryUsage();
  const root = `${INTEGRATION.discovery}/sensor/${INTEGRATION.node}/memory_usage`;
  if (memoryUsage !== null) {
    client.publish(`${root}/status`, `${memoryUsage}`, { qos: 1, retain: true });
  }
};

/**
 * Initializes the processor usage sensor.
 *
 * @param {Object} client - Instance of the mqtt client.
 */
const initProcessorUsage = (client) => {
  const root = `${INTEGRATION.discovery}/sensor/${INTEGRATION.node}/processor_usage`;
  const config = {
    name: `Processor Usage`,
    unique_id: `${INTEGRATION.node}_processor_usage`,
    state_topic: `${root}/status`,
    value_template: "{{ (value | float) | round(0) }}",
    unit_of_measurement: "%",
    icon: "mdi:cpu-64-bit",
    device: INTEGRATION.device,
  };
  client.publish(`${root}/config`, JSON.stringify(config), { qos: 1, retain: true });
  updateProcessorUsage(client);
};

/**
 * Updates the processor usage sensor via the mqtt connection.
 *
 * @param {Object} client - Instance of the mqtt client.
 */
const updateProcessorUsage = (client) => {
  const processorUsage = hardware.getProcessorUsage();
  const root = `${INTEGRATION.discovery}/sensor/${INTEGRATION.node}/processor_usage`;
  if (processorUsage !== null) {
    client.publish(`${root}/status`, `${processorUsage}`, { qos: 1, retain: true });
  }
};

/**
 * Initializes the processor temperature sensor.
 *
 * @param {Object} client - Instance of the mqtt client.
 */
const initProcessorTemperature = (client) => {
  const root = `${INTEGRATION.discovery}/sensor/${INTEGRATION.node}/processor_temperature`;
  const config = {
    name: `Processor Temperature`,
    unique_id: `${INTEGRATION.node}_processor_temperature`,
    state_topic: `${root}/status`,
    value_template: "{{ (value | float) | round(0) }}",
    unit_of_measurement: "°C",
    icon: "mdi:radiator",
    device: INTEGRATION.device,
  };
  client.publish(`${root}/config`, JSON.stringify(config), { qos: 1, retain: true });
  updateProcessorTemperature(client);
};

/**
 * Updates the processor temperature sensor via the mqtt connection.
 *
 * @param {Object} client - Instance of the mqtt client.
 */
const updateProcessorTemperature = (client) => {
  const processorTemperature = hardware.getProcessorTemperature();
  const root = `${INTEGRATION.discovery}/sensor/${INTEGRATION.node}/processor_temperature`;
  if (processorTemperature !== null) {
    client.publish(`${root}/status`, `${processorTemperature}`, { qos: 1, retain: true });
  }
};

/**
 * Initializes the package upgrades sensor.
 *
 * @param {Object} client - Instance of the mqtt client.
 */
const initPackageUpgrades = (client) => {
  const root = `${INTEGRATION.discovery}/sensor/${INTEGRATION.node}/package_upgrades`;
  const config = {
    name: `Package Upgrades`,
    unique_id: `${INTEGRATION.node}_package_upgrades`,
    state_topic: `${root}/status`,
    json_attributes_topic: `${root}/attributes`,
    value_template: "{{ value }}",
    icon: "mdi:package-down",
    device: INTEGRATION.device,
  };
  client.publish(`${root}/config`, JSON.stringify(config), { qos: 1, retain: true });
  updatePackageUpgrades(client);
};

/**
 * Updates the package upgrades sensor via the mqtt connection.
 *
 * @param {Object} client - Instance of the mqtt client.
 */
const updatePackageUpgrades = (client) => {
  const packages = hardware.checkPackageUpgrades();
  const root = `${INTEGRATION.discovery}/sensor/${INTEGRATION.node}/package_upgrades`;
  if (packages !== null) {
    const attributes = {
      total: packages.length,
      packages: packages.map((pkg) => pkg.replace(/\s*\[.*?\]\s*/g, "").trim()),
    };
    client.publish(`${root}/status`, `${attributes.total}`, { qos: 1, retain: true });
    client.publish(`${root}/attributes`, JSON.stringify(attributes), { qos: 1, retain: true });
  }
};

/**
 * Initializes the heartbeat sensor.
 *
 * @param {Object} client - Instance of the mqtt client.
 */
const initHeartbeat = (client) => {
  const root = `${INTEGRATION.discovery}/sensor/${INTEGRATION.node}/heartbeat`;
  const config = {
    name: `Heartbeat`,
    unique_id: `${INTEGRATION.node}_heartbeat`,
    state_topic: `${root}/status`,
    value_template: "{{ value }}",
    icon: "mdi:heart-flash",
    device: INTEGRATION.device,
  };
  client.publish(`${root}/config`, JSON.stringify(config), { qos: 1, retain: true });
  updateHeartbeat(client);
};

/**
 * Updates the heartbeat sensor via the mqtt connection.
 *
 * @param {Object} client - Instance of the mqtt client.
 */
const updateHeartbeat = (client) => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000);
  const heartbeat = local.toISOString().replace(/\.\d{3}Z$/, "");
  const root = `${INTEGRATION.discovery}/sensor/${INTEGRATION.node}/heartbeat`;
  client.publish(`${root}/status`, `${heartbeat}`, { qos: 1, retain: true });
};

/**
 * Initializes the last active sensor.
 *
 * @param {Object} client - Instance of the mqtt client.
 */
const initLastActive = (client) => {
  const root = `${INTEGRATION.discovery}/sensor/${INTEGRATION.node}/last_active`;
  const config = {
    name: `Last Active`,
    unique_id: `${INTEGRATION.node}_last_active`,
    state_topic: `${root}/status`,
    value_template: "{{ (value | float) | round(0) }}",
    unit_of_measurement: "min",
    icon: "mdi:gesture-tap-hold",
    device: INTEGRATION.device,
  };
  client.publish(`${root}/config`, JSON.stringify(config), { qos: 1, retain: true });
  updateLastActive(client);
};

/**
 * Updates the last active sensor via the mqtt connection.
 *
 * @param {Object} client - Instance of the mqtt client.
 */
const updateLastActive = (client) => {
  const now = new Date();
  const then = WEBVIEW.pointer.time;
  const lastActive = Math.abs(now - then) / (1000 * 60);
  const root = `${INTEGRATION.discovery}/sensor/${INTEGRATION.node}/last_active`;
  client.publish(`${root}/status`, `${lastActive}`, { qos: 1, retain: true });
};

module.exports = {
  init,
  update,
};
