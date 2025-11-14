const os = require("os");
const fs = require("fs");
const path = require("path");
const fsp = require("fs/promises");
const cpr = require("child_process");

global.HARDWARE = global.HARDWARE || {
  initialized: false,
  support: {},
  session: {},
  battery: {
    level: {
      path: null,
    },
  },
  display: {
    status: {
      path: null,
      command: null,
      value: {},
    },
    brightness: {
      path: null,
      command: null,
      value: {},
    },
  },
  keyboard: {
    visible: null,
  },
  audio: {
    device: null,
  },
};

/**
 * Initializes the hardware with the provided arguments.
 *
 * @returns {bool} Returns true if the initialization was successful.
 */
const init = async () => {
  if (!compatibleSystem()) {
    console.error("Operating system is not supported");
    return false;
  }

  // Init globals
  HARDWARE.session.user = sessionUser();
  HARDWARE.session.type = sessionType();
  HARDWARE.session.desktop = sessionDesktop();
  HARDWARE.battery.level.path = getBatteryLevelPath();
  HARDWARE.display.status.path = getDisplayStatusPath();
  HARDWARE.display.status.command = getDisplayStatusCommand();
  HARDWARE.display.brightness.path = getDisplayBrightnessPath();
  HARDWARE.display.brightness.command = getDisplayBrightnessCommand();
  HARDWARE.display.brightness.value.max = getDisplayBrightnessMax();
  HARDWARE.audio.device = getAudioDevice();
  HARDWARE.support = checkSupport();
  HARDWARE.initialized = true;

  // Show supported features
  process.stdout.write("\n");
  console.info(`Supported: ${JSON.stringify(HARDWARE.support, null, 2)}`);

  // Show session infos
  process.stdout.write("\n");
  console.info("User:", HARDWARE.session.user);
  console.info("Session:", HARDWARE.session.type);
  console.info("Desktop:", HARDWARE.session.desktop);

  // Show device infos
  process.stdout.write("\n");
  console.info("Model:", getModel());
  console.info("Vendor:", getVendor());
  console.info("Serial Number:", getSerialNumber());
  console.info("Network Addresses:", getNetworkAddresses());
  console.info("Host Name:", getHostName());

  // Show system infos
  process.stdout.write("\n");
  console.info("Up Time:", getUpTime());
  console.info("Memory Size:", getMemorySize());
  console.info("Memory Usage:", getMemoryUsage());
  console.info("Processor Usage:", getProcessorUsage());
  console.info("Processor Temperature:", getProcessorTemperature());

  // Show hardware infos
  process.stdout.write("\n");
  const unsupported = "unsupported";
  const batteryLevel = `${getBatteryLevel()} (sysfs)`;
  const batteryLevelInfo = HARDWARE.support.batteryLevel ? batteryLevel : unsupported;
  console.info(
    `Battery Level [${HARDWARE.support.batteryLevel ? HARDWARE.battery.level.path : unsupported}]:`,
    batteryLevelInfo,
  );
  const displayStatus = `${getDisplayStatus()} (${HARDWARE.display.status.command})`;
  const displayStatusInfo = HARDWARE.support.displayStatus ? displayStatus : unsupported;
  console.info(
    `Display Status [${HARDWARE.support.displayStatus ? HARDWARE.display.status.path : unsupported}]:`,
    displayStatusInfo,
  );
  const displayBrightness = `${getDisplayBrightness()} (${HARDWARE.display.brightness.command || "sysfs"})`;
  const displayBrightnessInfo = HARDWARE.support.displayBrightness ? displayBrightness : unsupported;
  console.info(
    `Display Brightness [${HARDWARE.support.displayBrightness ? HARDWARE.display.brightness.path || "ddc://vcp/feature/0x10" : unsupported}]:`,
    displayBrightnessInfo,
  );
  const audioVolume = `${getAudioVolume()} (pactl)`;
  const audioVolumeInfo = HARDWARE.support.audioVolume ? audioVolume : unsupported;
  console.info(
    `Audio Volume [${HARDWARE.support.audioVolume ? HARDWARE.audio.device : unsupported}]:`,
    audioVolumeInfo,
  );
  const keyboardVisibility = `${getKeyboardVisibility()} (squeekboard)`;
  const keyboardVisibilityInfo = HARDWARE.support.keyboardVisibility ? keyboardVisibility : unsupported;
  console.info(
    `Keyboard Visibility [${HARDWARE.support.keyboardVisibility ? "dbus://sm/puri/OSK0" : unsupported}]:`,
    keyboardVisibilityInfo,
  );
  process.stdout.write("\n");

  // Monitor audio volume
  if (HARDWARE.support.audioVolume) {
    commandMonitor("pactl", ["subscribe"], (reply, error) => {
      if (!reply || error) {
        return;
      }
      if (reply.includes("'change' on sink")) {
        console.info("Update Audio Volume:", getAudioVolume());
        EVENTS.emit("updateVolume");
      }
    });
  }

  // Monitor keyboard visibility
  if (HARDWARE.support.keyboardVisibility) {
    setKeyboardVisibility("OFF", (reply, error) => {
      if (!reply || error) {
        return;
      }
      dbusMonitor("/sm/puri/OSK0", (property, error) => {
        if (!property || error) {
          return;
        }
        HARDWARE.keyboard.visibility = property.Visible === "true";
        console.info("Update Keyboard Visibility:", getKeyboardVisibility());
        EVENTS.emit("updateKeyboard");
      });
    });
  }

  // Monitor display changes (1s)
  setDisplayStatus("ON", () => {
    interval(update, 1 * 1000);
  });

  return true;
};

/**
 * Updates the shared hardware properties.
 */
const update = async () => {
  if (!HARDWARE.initialized || APP.exiting) {
    return;
  }

  // Check if display status has changed
  if (HARDWARE.support.displayStatus) {
    let displayStatusChanged = false;

    // Use sysfs dpms path if available
    if (HARDWARE.display.status.path) {
      const power = await readFile(path.join(HARDWARE.display.status.path, "dpms"), false);
      const powerChanged = !!power && power !== HARDWARE.display.status.value.power;

      // Update internal status values
      HARDWARE.display.status.value.power = power;
      displayStatusChanged |= powerChanged;
    }

    // Use sysfs status path if available
    if (HARDWARE.display.status.path) {
      const connection = await readFile(path.join(HARDWARE.display.status.path, "status"), false);
      const connectionChanged = !!connection && connection !== HARDWARE.display.status.value.connection;

      // Update internal status values
      HARDWARE.display.status.value.connection = connection;
      displayStatusChanged |= connectionChanged;
    }

    // Emit display event if changed
    if (displayStatusChanged) {
      EVENTS.emit("updateDisplay");
      console.info("Update Display Status:", getDisplayStatus());
    }
  }

  // Check if display brightness has changed
  if (HARDWARE.support.displayBrightness) {
    let displayBrightnessChanged = false;

    // Use cache brightness path if available
    if (HARDWARE.display.brightness.command) {
      const brightness = await readFile(path.join(APP.cache, "Brightness.vcp"), false);
      const brightnessChanged = !!brightness && brightness !== HARDWARE.display.brightness.value.brightness;

      // Update internal brightness values
      HARDWARE.display.brightness.value.brightness = brightness;
      displayBrightnessChanged |= brightnessChanged;
    }

    // Use sysfs brightness path if available
    if (HARDWARE.display.brightness.path) {
      const brightness = await readFile(path.join(HARDWARE.display.brightness.path, "brightness"), false);
      const brightnessChanged = !!brightness && brightness !== HARDWARE.display.brightness.value.brightness;

      // Update internal brightness values
      HARDWARE.display.brightness.value.brightness = brightness;
      displayBrightnessChanged |= brightnessChanged;
    }

    // Emit display event if changed
    if (displayBrightnessChanged) {
      EVENTS.emit("updateDisplay");
      console.info("Update Display Brightness:", getDisplayBrightness());
    }
  }
};

/**
 * Verifies system compatibility by checking the presence of necessary sys paths.
 *
 * @returns {bool} Returns true if all paths exists.
 */
const compatibleSystem = () => {
  if (os.platform() !== "linux") {
    return false;
  }
  const paths = ["/sys/class/drm", "/sys/class/backlight", "/sys/class/power_supply", "/sys/class/thermal"];
  return paths.every((path) => fs.existsSync(path));
};

/**
 * Gets the session user name using `os.userInfo()`.
 *
 * @returns {string|null} Returns session user name or null if an error occurs.
 */
const sessionUser = () => {
  try {
    return os.userInfo().username;
  } catch {}
  return null;
};

/**
 * Gets the session type for the user using `loginctl`.
 *
 * @returns {string|null} Returns session type 'x11'/'wayland' or null if an error occurs.
 */
const sessionType = () => {
  if (!commandExists("loginctl")) {
    return null;
  }
  return execSyncCommand("loginctl", [
    "show-session",
    "$(loginctl show-user $(whoami) -p Display --value)",
    "-p Type --value",
  ]);
};

/**
 * Gets the desktop environment name by checking environment variables.
 *
 * @returns {string} Returns desktop environment name or 'unknown' if not detected.
 */
const sessionDesktop = () => {
  const envs = ["XDG_CURRENT_DESKTOP", "XDG_DESKTOP_SESSION", "DESKTOP_SESSION"];
  const names = envs.map((env) => process.env[env]).filter(Boolean);
  return (names.join(":") || "unknown").toLowerCase();
};

/**
 * Checks supported features based on hardware and software.
 *
 * @returns {Object} Returns support object with boolean values.
 */
const checkSupport = () => {
  const sudo = sudoRights();
  const service = serviceRuns(APP.name);
  const keyboard = processRuns("squeekboard");
  const release = APP.build.maker === "deb";

  const audioDevice = !!HARDWARE.audio.device;
  const batteryPath = !!HARDWARE.battery.level.path;
  const statusPath = !!HARDWARE.display.status.path;
  const statusCommand = !!HARDWARE.display.status.command;
  const brightnessPath = !!HARDWARE.display.brightness.path && !!HARDWARE.display.brightness.value.max;
  const brightnessCommand = !!HARDWARE.display.brightness.command && !!HARDWARE.display.brightness.value.max;

  return {
    batteryLevel: batteryPath,
    displayStatus: statusPath && statusCommand,
    displayBrightness: sudo && statusPath && statusCommand && (brightnessPath || brightnessCommand),
    keyboardVisibility: keyboard,
    audioVolume: audioDevice,
    sudoRights: sudo,
    appUpdate: service && sudo && release,
  };
};

/**
 * Gets the model name using `/sys/firmware/devicetree/base/model` or `/sys/class/dmi/id/product_name`.
 *
 * @returns {string} The model name of the device or 'Generic' if not found.
 */
const getModel = () => {
  const paths = ["/sys/firmware/devicetree/base/model", "/sys/class/dmi/id/product_name"];
  for (const path of paths) {
    if (fs.existsSync(path)) {
      return execSyncCommand("cat", [path]) || "Generic";
    }
  }
  return "Generic";
};

/**
 * Gets the vendor name using `/sys/class/dmi/id/board_vendor`.
 *
 * @returns {string} The vendor name of the device or 'Generic' if not found.
 */
const getVendor = () => {
  const paths = ["/sys/class/dmi/id/board_vendor"];
  for (const path of paths) {
    if (fs.existsSync(path)) {
      return execSyncCommand("cat", [path]) || "Generic";
    }
  }
  const model = getModel();
  if (model.includes("Raspberry Pi")) {
    return "Raspberry Pi Ltd";
  }
  return "Generic";
};

/**
 * Gets the serial number using `/sys/firmware/devicetree/base/serial-number`.
 *
 * @returns {string} The serial number or machine id parts of the device or '123456' if not found.
 */
const getSerialNumber = () => {
  const paths = ["/sys/firmware/devicetree/base/serial-number"];
  for (const path of paths) {
    if (fs.existsSync(path)) {
      return execSyncCommand("cat", [path]) || "123456";
    }
  }
  return getMachineId().slice(-6);
};

/**
 * Gets the machine id using `/etc/machine-id`.
 *
 * @returns {string} The machine id of the system or '123456' if not found.
 */
const getMachineId = () => {
  const paths = ["/etc/machine-id"];
  for (const path of paths) {
    if (fs.existsSync(path)) {
      return execSyncCommand("cat", [path]) || "123456";
    }
  }
  return "123456";
};

/**
 * Gets the network interfaces addresses using `os.networkInterfaces()`.
 *
 * @returns {Object} The network addresses of all interfaces.
 */
const getNetworkAddresses = () => {
  const addresses = {};
  for (const [key, interfaces] of Object.entries(os.networkInterfaces())) {
    for (const interface of interfaces) {
      if (interface.internal || !interface.family || !interface.address) {
        continue;
      }
      const name = key.charAt(0).toUpperCase() + key.slice(1);
      if (!addresses[name]) {
        addresses[name] = {};
      }
      const family = interface.family;
      if (!addresses[name][family]) {
        addresses[name][family] = [];
      }
      addresses[name][family].push(interface.address);
    }
  }
  return addresses;
};

/**
 * Gets the host name of the current system using `os.hostname()`.
 *
 * @returns {string} The host name of the system.
 */
const getHostName = () => {
  return os.hostname();
};

/**
 * Gets the up time of the system in minutes using `os.uptime()`.
 *
 * @returns {number} The up time of the system in minutes.
 */
const getUpTime = () => {
  return os.uptime() / 60;
};

/**
 * Gets the total available memory in gibibytes using `os.totalmem()`.
 *
 * @returns {number} The total available memory in GiB.
 */
const getMemorySize = () => {
  return os.totalmem() / 1024 ** 3;
};

/**
 * Gets the current memory usage as a percentage using `os.totalmem()` and `os.freemem()`.
 *
 * @returns {number} The percentage of used memory.
 */
const getMemoryUsage = () => {
  return ((os.totalmem() - os.freemem()) / os.totalmem()) * 100;
};

/**
 * Gets the CPU load average over the last 5 minutes as a percentage using `os.loadavg()` and `os.cpus()`.
 *
 * @returns {number} The CPU load average percentage over the last 5 minutes.
 */
const getProcessorUsage = () => {
  return (os.loadavg()[1] / os.cpus().length) * 100;
};

/**
 * Gets the current CPU temperature using `/sys/class/thermal`.
 *
 * @returns {number|null} The CPU temperature in degrees celsius or null if nothing was found.
 */
const getProcessorTemperature = () => {
  const thermal = "/sys/class/thermal";
  for (const zone of fs.readdirSync(thermal)) {
    const typeFile = path.join(thermal, zone, "type");
    const tempFile = path.join(thermal, zone, "temp");
    if (!fs.existsSync(typeFile) || !fs.existsSync(tempFile)) {
      continue;
    }
    const type = readFile(typeFile);
    if (["cpu-thermal", "x86_pkg_temp", "k10temp", "acpitz", "cpu"].includes(type)) {
      const temp = readFile(tempFile);
      if (temp) {
        return parseFloat(temp) / 1000;
      }
    }
  }
  return null;
};

/**
 * Gets the current battery power level path using `/sys/class/power_supply`.
 *
 * @returns {string|null} The battery power level path or null if nothing was found.
 */
const getBatteryLevelPath = () => {
  const power = "/sys/class/power_supply";
  for (const supply of fs.readdirSync(power)) {
    const capacityFile = path.join(power, supply, "capacity");
    if (!fs.existsSync(capacityFile)) {
      continue;
    }
    return path.join(power, supply);
  }
  return null;
};

/**
 * Gets the current battery power level using `/sys/class/power_supply/.../capacity`.
 *
 * @returns {number|null} The battery power level in percentage or null if nothing was found.
 */
const getBatteryLevel = () => {
  if (!HARDWARE.support.batteryLevel) {
    return null;
  }
  const capacity = readFile(`${HARDWARE.battery.level.path}/capacity`);
  if (capacity) {
    return parseFloat(capacity);
  }
  return null;
};

/**
 * Gets the current display status path using `/sys/class/drm`.
 *
 * @returns {string|null} The display status path or null if nothing was found.
 */
const getDisplayStatusPath = () => {
  const drm = "/sys/class/drm";
  for (const card of fs.readdirSync(drm)) {
    const statusFile = path.join(drm, card, "status");
    if (!fs.existsSync(statusFile)) {
      continue;
    }
    const content = readFile(statusFile);
    if (content === "connected") {
      return path.join(drm, card);
    }
  }
  return null;
};

/**
 * Gets the available display status command checking for `wlopm`, `kscreen-doctor` and `xset`.
 *
 * @returns {string|null} The display status command or null if nothing was found.
 */
const getDisplayStatusCommand = () => {
  const type = HARDWARE.session.type;
  const desktop = HARDWARE.session.desktop;
  const mapping = {
    wayland: [
      { command: "wlopm", desktops: ["labwc", "wayfire", "unknown"] },
      { command: "kscreen-doctor", desktops: ["kde", "plasma", "unknown"] },
    ],
    x11: [{ command: "xset", desktops: ["*"] }],
  }[type];
  for (const map of mapping || []) {
    if (commandExists(map.command) && map.desktops.some((d) => d === "*" || desktop.includes(d))) {
      return map.command;
    }
  }
  return null;
};

/**
 * Gets the current display power status using the available command.
 *
 * @returns {string|null} The display status as 'ON'/'OFF' or null if an error occurs.
 */
const getDisplayStatus = () => {
  if (!HARDWARE.support.displayStatus) {
    return null;
  }
  switch (HARDWARE.display.status.command) {
    case "wlopm":
      const wlopm = execSyncCommand("wlopm", []);
      if (wlopm !== null) {
        const output = wlopm.split("\n")[0].split(" ");
        return output.pop().toUpperCase();
      }
      break;
    case "kscreen-doctor":
      const kdoc = execSyncCommand("kscreen-doctor", ["--dpms", "show"]);
      if (kdoc !== null) {
        const output = kdoc.split("\n")[0].split(" ");
        return output.pop().toUpperCase();
      }
      break;
    case "xset":
      const xset = execSyncCommand("xset", ["-q"]);
      if (xset !== null) {
        const output = xset.includes("Monitor is On");
        return output ? "ON" : "OFF";
      }
      break;
  }
  return null;
};

/**
 * Sets the display power status using the available command.
 *
 * This function takes a desired status ('ON' or 'OFF') and executes
 * the appropriate command to set the display status.
 *
 * @param {string} status - The desired status ('ON' or 'OFF').
 * @param {Function} callback - A callback function that receives the output or error.
 */
const setDisplayStatus = (status, callback = null) => {
  if (!HARDWARE.support.displayStatus) {
    if (typeof callback === "function") callback(null, "Not supported");
    return;
  }
  if (!["ON", "OFF"].includes(status)) {
    console.error("Status must be 'ON' or 'OFF'");
    if (typeof callback === "function") callback(null, "Invalid status");
    return;
  }
  switch (HARDWARE.display.status.command) {
    case "wlopm":
      execAsyncCommand("wlopm", [`--${status.toLowerCase()}`, "*"], callback);
      break;
    case "kscreen-doctor":
      execAsyncCommand("kscreen-doctor", ["--dpms", status.toLowerCase()], callback);
      break;
    case "xset":
      execAsyncCommand("xset", ["dpms", "force", status.toLowerCase()], callback);
      break;
  }
};

/**
 * Gets the current display brightness path using `/sys/class/backlight`.
 *
 * @returns {string|null} The display brightness path or null if nothing was found.
 */
const getDisplayBrightnessPath = () => {
  const backlight = "/sys/class/backlight";
  for (const address of fs.readdirSync(backlight)) {
    const brightnessFile = path.join(backlight, address, "brightness");
    if (!fs.existsSync(brightnessFile)) {
      continue;
    }
    return path.join(backlight, address);
  }
  return null;
};

/**
 * Gets the available display brightness command checking for `ddcutil`.
 *
 * @returns {string|null} The display brightness command or null if nothing was found.
 */
const getDisplayBrightnessCommand = () => {
  const type = HARDWARE.session.type;
  const desktop = HARDWARE.session.desktop;
  const mapping = {
    wayland: [{ command: "ddcutil", desktops: ["*"] }],
    x11: [{ command: "ddcutil", desktops: ["*"] }],
  }[type];
  for (const map of mapping || []) {
    if (sudoRights() && commandExists(map.command) && map.desktops.some((d) => d === "*" || desktop.includes(d))) {
      HARDWARE.display.brightness.path = null;
      switch (map.command) {
        case "ddcutil":
          const output = execSyncCommand("sudo", ["ddcutil", "capabilities"]);
          if (output && output.includes("Feature: 10")) {
            fs.writeFileSync(path.join(APP.cache, "Brightness.vcp"), "");
            return map.command;
          }
          break;
        default:
          return map.command;
      }
    }
  }
  return null;
};

/**
 * Gets the maximum display brightness value using `/sys/class/backlight/.../max_brightness` or `ddcutil getvcp 10`.
 *
 * @returns {number|null} The brightness maximum value or null if an error occurs.
 */
const getDisplayBrightnessMax = () => {
  switch (HARDWARE.display.brightness.command) {
    case "ddcutil":
      const output = execSyncCommand("sudo", ["ddcutil", "getvcp", "10", "--brief"]);
      const match = output ? output.match(/VCP 10 C (\d+) (\d+)/) : null;
      if (match) {
        return parseInt(match[2], 10);
      }
      return null;
  }
  if (HARDWARE.display.brightness.path) {
    const max = readFile(path.join(HARDWARE.display.brightness.path, "max_brightness"));
    if (max) {
      return parseInt(max, 10);
    }
  }
  return null;
};

/**
 * Gets the current display brightness level using `/sys/class/backlight/.../brightness` or `ddcutil getvcp 10`.
 *
 * @returns {number|null} The brightness level as a percentage or null if an error occurs.
 */
const getDisplayBrightness = () => {
  if (!HARDWARE.support.displayBrightness) {
    return null;
  }
  switch (HARDWARE.display.brightness.command) {
    case "ddcutil":
      const output = execSyncCommand("sudo", ["ddcutil", "getvcp", "10", "--brief"]);
      const match = output ? output.match(/VCP 10 C (\d+) (\d+)/) : null;
      if (match) {
        return parseInt(match[1], 10);
      }
      return null;
  }
  if (HARDWARE.display.brightness.path) {
    const brightness = readFile(path.join(HARDWARE.display.brightness.path, "brightness"));
    if (brightness) {
      const max = HARDWARE.display.brightness.value.max || 1;
      return Math.max(1, Math.min(Math.round((parseInt(brightness, 10) / max) * 100), 100));
    }
  }
  return null;
};

/**
 * Sets the display brightness level using `/sys/class/backlight/.../brightness` or `ddcutil setvcp 10`.
 *
 * This function takes a brightness value between 1 to 100 percent,
 * maps it to the proper range and writes it to the system.
 *
 * @param {number} brightness - The desired brightness level (1-100).
 * @param {Function} callback - A callback function that receives the output or error.
 */
const setDisplayBrightness = (brightness, callback = null) => {
  if (!HARDWARE.support.displayBrightness) {
    if (typeof callback === "function") callback(null, "Not supported");
    return;
  }
  if (typeof brightness !== "number" || brightness < 1 || brightness > 100) {
    console.error("Brightness must be a number between 1 and 100");
    if (typeof callback === "function") callback(null, "Invalid brightness");
    return;
  }
  switch (HARDWARE.display.brightness.command) {
    case "ddcutil":
      execAsyncCommand("sudo", ["ddcutil", "setvcp", "10", `${brightness}`], (reply, error) => {
        if (!error) {
          fs.writeFileSync(path.join(APP.cache, "Brightness.vcp"), `${brightness}`);
        }
        if (typeof callback === "function") callback(reply, error);
      });
      return;
  }
  if (HARDWARE.display.brightness.path) {
    const max = HARDWARE.display.brightness.value.max || 1;
    const value = Math.max(1, Math.min(Math.round((brightness / 100) * max), max));
    const proc = execAsyncCommand("sudo", ["tee", path.join(HARDWARE.display.brightness.path, "brightness")], callback);
    proc.stdin.write(value.toString());
    proc.stdin.end();
  }
};

/**
 * Gets the default audio device using `pactl`.
 *
 * @returns {string|null} The default audio device or null if an error occurs.
 */
const getAudioDevice = () => {
  if (!commandExists("pactl")) {
    return null;
  }
  const output = execSyncCommand("pactl", ["get-default-sink"]);
  if (!output) {
    return null;
  }
  return !output.includes("auto_null") ? output.trim() : null;
};

/**
 * Gets the default audio device volume using `pactl`.
 *
 * @returns {number|null} The default audio device volume as a percentage or null if an error occurs.
 */
const getAudioVolume = () => {
  if (!HARDWARE.support.audioVolume) {
    return null;
  }
  const mute = execSyncCommand("pactl", ["get-sink-mute", "@DEFAULT_SINK@"]);
  const volume = execSyncCommand("pactl", ["get-sink-volume", "@DEFAULT_SINK@"]);
  if (!mute || !volume) {
    return null;
  }
  const match = volume.match(/\/(\s*(\d+)%)/);
  if (match) {
    return Math.max(0, Math.min(100, mute.includes("yes") ? 0 : parseInt(match[2], 10)));
  }
  return null;
};

/**
 * Sets the default audio device volume using `pactl`.
 *
 * This function takes a volume value between 0 to 100 percent and sends it to the device.
 *
 * @param {number} volume - The desired volume level (0-100).
 * @param {Function} callback - A callback function that receives the output or error.
 */
const setAudioVolume = (volume, callback = null) => {
  if (!HARDWARE.support.audioVolume) {
    if (typeof callback === "function") callback(null, "Not supported");
    return;
  }
  if (typeof volume !== "number" || volume < 0 || volume > 100) {
    console.error("Volume must be a number between 0 and 100");
    if (typeof callback === "function") callback(null, "Invalid volume");
    return;
  }
  execAsyncCommand("pactl", ["set-sink-mute", "@DEFAULT_SINK@", volume === 0 ? "1" : "0"]);
  execAsyncCommand("pactl", ["set-sink-volume", "@DEFAULT_SINK@", `${volume}%`], callback);
};

/**
 * Gets the keyboard visibility using global properties.
 *
 * @returns {string|null} The keyboard visibility as 'ON'/'OFF' or null if an error occurs.
 */
const getKeyboardVisibility = () => {
  if (!HARDWARE.support.keyboardVisibility) {
    return null;
  }
  return HARDWARE.keyboard.visibility ? "ON" : "OFF";
};

/**
 * Sets the keyboard visibility using `dbus-send`.
 *
 * This function takes a desired visibility ('ON' or 'OFF') and executes
 * the appropriate command to show or hide the keyboard.
 *
 * @param {bool} visibility - The desired visibility ('ON' or 'OFF').
 * @param {Function} callback - A callback function that receives the output or error.
 */
const setKeyboardVisibility = (visibility, callback = null) => {
  if (!HARDWARE.support.keyboardVisibility) {
    if (typeof callback === "function") callback(null, "Not supported");
    return;
  }
  if (!["ON", "OFF"].includes(visibility)) {
    console.error("Visibility must be 'ON' or 'OFF'");
    if (typeof callback === "function") callback(null, "Invalid visibility");
    return;
  }
  const visible = visibility === "ON";
  HARDWARE.keyboard.visibility = visible;
  dbusCall("/sm/puri/OSK0", "SetVisible", [`boolean:${visible}`], callback);
};

/**
 * Checks if system upgrades are available using `apt`.
 *
 * @returns {Array<string>} A list of package names that are available for upgrade.
 */
const checkPackageUpgrades = () => {
  if (!commandExists("apt")) {
    return [];
  }
  const output = execSyncCommand("apt", ["list", "--upgradable", "2>/dev/null"]);
  const packages = (output || "").trim().split("\n");
  packages.shift();
  return packages;
};

/**
 * Shuts down the system using `sudo shutdown -h now`.
 *
 * This function executes the command asynchronously.
 * The output of the command will be provided through the callback function.
 *
 * @param {Function} callback - A callback function that receives the output or error.
 */
const shutdownSystem = (callback = null) => {
  if (!HARDWARE.support.sudoRights) {
    if (typeof callback === "function") callback(null, "Not supported");
    return;
  }
  execAsyncCommand("sudo", ["shutdown", "-h", "now"], callback);
};

/**
 * Reboots the system using `sudo reboot`.
 *
 * This function executes the command asynchronously.
 * The output of the command will be provided through the callback function.
 *
 * @param {Function} callback - A callback function that receives the output or error.
 */
const rebootSystem = (callback = null) => {
  if (!HARDWARE.support.sudoRights) {
    if (typeof callback === "function") callback(null, "Not supported");
    return;
  }
  execAsyncCommand("sudo", ["reboot"], callback);
};

/**
 * Checks if sudo commands can run without a password.
 *
 * @returns {bool} Returns true if password-less sudo rights exists.
 */
const sudoRights = () => {
  try {
    cpr.execSync(`sudo -n true`, { encoding: "utf8", stdio: "ignore" });
    return true;
  } catch {}
  return false;
};

/**
 * Checks if a service is running using `systemctl`.
 *
 * @param {string} name - The service name to check.
 * @returns {bool} Returns true if the service runs.
 */
const serviceRuns = (name) => {
  try {
    cpr.execSync(`systemctl --user is-active ${name}`, { encoding: "utf8", stdio: "ignore" });
    return true;
  } catch {}
  return false;
};

/**
 * Checks if a process is running using `pidof`.
 *
 * @param {string} name - The process name to check.
 * @returns {bool} Returns true if the process runs.
 */
const processRuns = (name) => {
  try {
    cpr.execSync(`pidof ${name}`, { encoding: "utf8", stdio: "ignore" });
    return true;
  } catch {}
  return false;
};

/**
 * Checks if a command is available using `which`.
 *
 * @param {string} name - The command name to check.
 * @returns {bool} Returns true if the command is available.
 */
const commandExists = (name) => {
  try {
    cpr.execSync(`which ${name}`, { encoding: "utf8", stdio: "ignore" });
    return true;
  } catch {}
  return false;
};

/**
 * Executes a command synchronously and returns the output.
 *
 * @param {string} cmd - The command to execute.
 * @param {Array<string>} args - The arguments for the command.
 * @returns {string|null} The output of the command or null if an error occurs.
 */
const execSyncCommand = (cmd, args) => {
  try {
    console.debug(`hardware.js: execSyncCommand(${[cmd, ...args].join(" ")})`);
    const output = cpr.execSync([cmd, ...args].join(" "), { encoding: "utf8" });
    return output.trim().replace(/\0/g, "");
  } catch (error) {
    console.error(`Execute Sync: '${[cmd, ...args].join(" ")}' --> ${error.message}`.trim());
  }
  return null;
};

/**
 * Executes a command asynchronously.
 *
 * @param {string} cmd - The command to execute.
 * @param {Array<string>} args - The arguments for the command.
 * @param {Function} callback - A callback function that receives the output or error.
 * @returns {Object} The spawned process object.
 */
const execAsyncCommand = (cmd, args, callback = null) => {
  console.debug(`hardware.js: execAsyncCommand(${[cmd, ...args].join(" ")})`);
  let errorOutput = "";
  let successOutput = "";
  let proc = cpr.spawn(cmd, args);
  proc.stderr.on("data", (data) => {
    if (data) {
      errorOutput += data.toString();
    }
  });
  proc.stdout.on("data", (data) => {
    if (data) {
      successOutput += data.toString();
    }
  });
  proc.on("close", (code) => {
    const error = errorOutput.trim().replace(/\0/g, "");
    const reply = successOutput.trim().replace(/\0/g, "");
    if (code !== 0 || error) {
      console.error(`Execute Async: '${[cmd, ...args].join(" ")}' --> ${error} (${code})`);
      if (typeof callback === "function") callback(null, error);
    } else {
      if (typeof callback === "function") callback(reply, null);
    }
  });
  return proc;
};

/**
 * Executes a script command asynchronously.
 *
 * @param {string} cmd - The script to execute.
 * @param {Array<string>} args - The arguments for the command.
 * @param {Function} callback - A callback function that receives the progress or error.
 * @returns {Object} The spawned process object.
 */
const execScriptCommand = (cmd, args, callback = null) => {
  console.debug(`hardware.js: execScriptCommand(${[cmd, ...args].join(" ")})`);
  let progress = 1;
  let proc = cpr.spawn(cmd, args);
  if (typeof callback === "function") callback(progress, null);
  proc.stdout.on("data", (data) => {
    if (data) {
      const output = data.toString().trim();
      const lines = output.replace(/\n+/g, "\n").replace(/^\n+|\n+$|\0/g, "");
      for (const line of lines.split("\n").filter(Boolean)) {
        console.info(line);
      }
    }
  });
  proc.stderr.on("data", (data) => {
    if (data) {
      const output = data.toString().trim();
      const lines = output.replace(/\n+/g, "\n").replace(/^\n+|\n+$|\0/g, "");
      for (const line of lines.split("\n").filter(Boolean)) {
        const matches = line.match(/(\d{1,3})%/g);
        if (matches) {
          const match = Math.max(...matches.map((p) => parseInt(p, 10)));
          const percent = Math.floor(match / 10) * 10;
          if (percent > 10 && percent > progress) {
            progress = percent;
            if (typeof callback === "function") callback(progress - 10, null);
          }
        }
      }
    }
  });
  proc.on("close", (code) => {
    if (code !== 0) {
      console.error(`Script exited with error code (${code}).`);
      if (typeof callback === "function") callback(null, code);
    } else {
      console.info("Script exited successfully.");
      if (typeof callback === "function") callback(100, null);
    }
  });
};

/**
 * Monitors a command asynchronously.
 *
 * @param {string} cmd - The command to monitor.
 * @param {Array<string>} args - The arguments for the command.
 * @param {Function} callback - A callback function that receives the output or error.
 * @returns {Object} The spawned process object.
 */
const commandMonitor = (cmd, args, callback = null) => {
  console.debug(`hardware.js: commandMonitor(${[cmd, ...args].join(" ")})`);
  const proc = cpr.spawn(cmd, args);
  proc.stdout.on("data", (data) => {
    if (data) {
      const output = data.toString().trim().replace(/\0/g, "");
      if (typeof callback === "function") callback(output, null);
    }
  });
  proc.stderr.on("data", (data) => {
    if (data) {
      const output = data.toString().trim().replace(/\0/g, "");
      if (typeof callback === "function") callback(null, output);
    }
  });
  return proc;
};

/**
 * Monitors D-Bus property changes asynchronously using `dbus-monitor`.
 *
 * @param {string} path - The D-Bus object path.
 * @param {Function} callback - A callback function that receives the changed property.
 * @returns {Object} The spawned process object.
 */
const dbusMonitor = (path, callback = null) => {
  const cmd = "dbus-monitor";
  const args = [`interface='org.freedesktop.DBus.Properties',member='PropertiesChanged',path='${path}'`];
  console.debug(`hardware.js: dbusMonitor(${[cmd, ...args].join(" ")})`);
  const proc = cpr.spawn(cmd, args);
  proc.stdout.on("data", (data) => {
    try {
      const signal = data.toString();
      if (signal.includes(`string "Visible"`)) {
        const dicts = [...signal.matchAll(/dict entry\(\s*([^)]*?)\)/g)].map((dict) => dict[1].trim());
        if (dicts.length) {
          dicts.forEach((dict) => {
            const key = dict.match(/string "(.*?)"/);
            const value = dict.match(/(?<=variant\s+)(.*)/);
            if (key && value) {
              const property = { [key[1].trim()]: value[1].trim().split(" ").pop() };
              if (typeof callback === "function") callback(property, null);
            }
          });
        } else {
          const property = { Visible: `${HARDWARE.keyboard.visibility}` };
          if (typeof callback === "function") callback(property, null);
        }
      }
    } catch (error) {
      console.error("Monitor D-Bus:", error.message);
      if (typeof callback === "function") callback(null, error.message);
    }
  });
  proc.stderr.on("data", (data) => {
    if (data) {
      console.error("Monitor D-Bus:", data.toString());
      if (typeof callback === "function") callback(null, data.toString());
    }
  });
  return proc;
};

/**
 * Executes a D-Bus method call synchronously using `dbus-send`.
 *
 * @param {string} path - The D-Bus object path.
 * @param {string} method - The D-Bus method name.
 * @param {Array<string>} values - The argument values for the D-Bus method.
 * @param {Function} callback - A callback function that receives the output or error.
 */
const dbusCall = (path, method, values, callback = null) => {
  const cmd = "dbus-send";
  const iface = path.slice(1).replace(/\//g, ".");
  const dest = `${iface} ${path} ${iface}.${method} ${values.join(" ")}`;
  const args = ["--print-reply", "--type=method_call", `--dest=${dest}`];
  try {
    console.debug(`hardware.js: dbusCall(${[cmd, ...args].join(" ")})`);
    const output = cpr.execSync([cmd, ...args].join(" ").trim(), { encoding: "utf8" });
    if (typeof callback === "function") callback(output.trim().replace(/\0/g, ""), null);
  } catch (error) {
    console.error("Call D-Bus:", error.message);
    if (typeof callback === "function") callback(null, error.message);
  }
};

/**
 * Reads file content synchronously or asynchronously from the filesystem.
 *
 * @param {string} path - Path of the file.
 * @param {boolean} sync - If true, reads the file synchronously, otherwise asynchronously.
 * @returns {string|null|Promise<string|null>} The file content or null if an error occurs.
 */
const readFile = (path, sync = true) => {
  if (!sync) {
    return fsp
      .readFile(path, "utf8")
      .then((content) => content.trim())
      .catch((error) => {
        console.error(`Read File ${path} Async:`, error.message);
        return null;
      });
  }
  try {
    return fs.readFileSync(path, "utf8").trim();
  } catch (error) {
    console.error(`Read File ${path} Sync:`, error.message);
  }
  return null;
};

/**
 * Helper function for asynchronous interval calls.
 *
 * @param {Function} callback - An async callback function.
 * @param {number} ms - Sleep time in milliseconds.
 */
const interval = (callback, ms) => {
  const run = () => {
    setTimeout(async () => {
      try {
        await callback();
      } catch (error) {
        console.error("Interval Async:", error.message);
      }
      run();
    }, ms);
  };
  run();
};

module.exports = {
  init,
  update,
  getModel,
  getVendor,
  getSerialNumber,
  getMachineId,
  getNetworkAddresses,
  getHostName,
  getUpTime,
  getMemorySize,
  getMemoryUsage,
  getProcessorUsage,
  getProcessorTemperature,
  getBatteryLevel,
  getDisplayStatus,
  setDisplayStatus,
  getDisplayBrightness,
  setDisplayBrightness,
  getAudioVolume,
  setAudioVolume,
  getKeyboardVisibility,
  setKeyboardVisibility,
  checkPackageUpgrades,
  shutdownSystem,
  rebootSystem,
  execSyncCommand,
  execAsyncCommand,
  execScriptCommand,
};
