const os = require("os");
const fs = require("fs");
const path = require("path");
const fsp = require("fs/promises");
const cpr = require("child_process");
const Events = require("events");

global.HARDWARE = global.HARDWARE || {
  initialized: false,
  events: new Events(),
  session: {},
  support: {},
  battery: {
    level: {
      path: null,
    },
  },
  display: {
    status: {
      value: null,
      path: null,
      command: null,
    },
    brightness: {
      value: null,
      path: null,
      max: null,
    },
  },
  keyboard: {
    visible: null,
  },
};

/**
 * Initializes the hardware with the provided arguments.
 *
 * @returns {bool} Returns true if the initialization was successful.
 */
const init = async () => {
  if (!compatibleSystem()) {
    console.warn("Operating system is not supported\n");
    return false;
  }
  if (!sessionRights()) {
    console.warn(`User "${sessionUser()}" is missing password-less sudo rights\n`);
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
  HARDWARE.display.brightness.max = getDisplayBrightnessMax();
  HARDWARE.support = checkSupport();
  HARDWARE.initialized = true;

  // Show supported features
  console.log(`Supported: ${JSON.stringify(HARDWARE.support, null, 2)}`);

  // Show session infos
  console.log("\nUser:", HARDWARE.session.user);
  console.log("Session:", HARDWARE.session.type);
  console.log("Desktop:", HARDWARE.session.desktop);

  // Show device infos
  console.log("\nModel:", getModel());
  console.log("Vendor:", getVendor());
  console.log("Serial Number:", getSerialNumber());
  console.log("Host Name:", getHostName());

  // Show system infos
  console.log("\nUp Time:", getUpTime());
  console.log("Memory Size:", getMemorySize());
  console.log("Memory Usage:", getMemoryUsage());
  console.log("Processor Usage:", getProcessorUsage());
  console.log("Processor Temperature:", getProcessorTemperature());

  // Show hardware infos
  const unsupported = "unsupported";
  console.log(
    `\nBattery Level [${HARDWARE.battery.level.path || unsupported}]:`,
    `${getBatteryLevel() || unsupported}`,
  );
  console.log(
    `Display Status [${HARDWARE.display.status.path || unsupported}]:`,
    `${getDisplayStatus() || unsupported} (${HARDWARE.display.status.command || unsupported})`,
  );
  console.log(
    `Display Brightness [${HARDWARE.display.brightness.path || unsupported}]:`,
    `${getDisplayBrightness() || unsupported}`,
  );
  console.log(
    `Keyboard Visibility [${HARDWARE.support.keyboardVisibility ? "squeekboard" : unsupported}]:`,
    `${getKeyboardVisibility() || unsupported}\n`,
  );

  // Check for keyboard visibility
  setKeyboardVisibility("OFF", (reply, error) => {
    if (!reply || error) {
      return;
    }
    dbusMonitor("/sm/puri/OSK0", (property, error) => {
      if (!property || error) {
        return;
      }
      HARDWARE.keyboard.visibility = property.Visible === "true";
      HARDWARE.events.emit("updateKeyboard");
    });
  });

  // Check for display changes
  interval(update, 1000);

  return true;
};

/**
 * Updates the shared hardware properties.
 */
const update = async () => {
  if (!HARDWARE.initialized) {
    return;
  }

  // Display status has changed
  if (HARDWARE.support.displayStatus) {
    const status = (await fsp.readFile(`${HARDWARE.display.status.path}/dpms`, "utf8")).trim();
    if (status !== HARDWARE.display.status.value) {
      console.log("Update Display Status:", getDisplayStatus());
      HARDWARE.display.status.value = status;
      HARDWARE.events.emit("updateDisplay");
    }
  }

  // Display brightness has changed
  if (HARDWARE.support.displayBrightness) {
    const brightness = (await fsp.readFile(`${HARDWARE.display.brightness.path}/brightness`, "utf8")).trim();
    if (brightness !== HARDWARE.display.brightness.value) {
      console.log("Update Display Brightness:", getDisplayBrightness());
      HARDWARE.display.brightness.value = brightness;
      HARDWARE.events.emit("updateDisplay");
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
 * Verifies user rights to run sudo commands without a password.
 *
 * @returns {bool} Returns true if password-less sudo rights exists.
 */
const sessionRights = () => {
  if (!commandExists("sudo")) {
    return false;
  }
  const result = execSyncCommand("sudo", ["-n", "true"]);
  return result !== null && !result.includes("password is required");
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
 * Checks supported features based on global properties.
 *
 * @returns {Object} Returns support object with boolean values.
 */
const checkSupport = () => {
  const battery = HARDWARE.battery.level;
  const status = HARDWARE.display.status;
  const brightness = HARDWARE.display.brightness;
  const keyboard = processRuns("squeekboard");
  return {
    batteryLevel: battery.path !== null,
    displayStatus: status.path !== null && status.command !== null,
    displayBrightness: brightness.path !== null && brightness.max !== null,
    keyboardVisibility: keyboard === true,
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
      return execSyncCommand("sudo", ["cat", path]) || "Generic";
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
      return execSyncCommand("sudo", ["cat", path]) || "Generic";
    }
  }
  const model = getModel();
  if (model.includes("Raspberry Pi")) {
    return "Raspberry Pi Ltd";
  }
  return "Generic";
};

/**
 * Gets the serial number using `/sys/firmware/devicetree/base/serial-number` or `/sys/class/dmi/id/product_serial`.
 *
 * @returns {string} The serial number of the device or '123456' if not found.
 */
const getSerialNumber = () => {
  const paths = ["/sys/firmware/devicetree/base/serial-number", "/sys/class/dmi/id/product_serial"];
  for (const path of paths) {
    if (fs.existsSync(path)) {
      return execSyncCommand("sudo", ["cat", path]) || "123456";
    }
  }
  return "123456";
};

/**
 * Gets the host machine id using `/etc/machine-id`.
 *
 * @returns {string} The machine id of the system or '123456' if not found.
 */
const getMachineId = () => {
  const paths = ["/etc/machine-id"];
  for (const path of paths) {
    if (fs.existsSync(path)) {
      return execSyncCommand("sudo", ["cat", path]) || "123456";
    }
  }
  return "123456";
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
    const type = fs.readFileSync(typeFile, "utf8").trim();
    if (["cpu-thermal", "x86_pkg_temp", "k10temp", "acpitz"].includes(type)) {
      return parseFloat(fs.readFileSync(tempFile, "utf8").trim()) / 1000;
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
  const capacity = fs.readFileSync(`${HARDWARE.battery.level.path}/capacity`, "utf8").trim();
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
    const content = fs.readFileSync(statusFile, "utf8").trim();
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
  console.warn("No display command available");
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
        const out = wlopm.split("\n")[0].split(" ");
        return out.pop().toUpperCase();
      }
      break;
    case "kscreen-doctor":
      const kdoc = execSyncCommand("kscreen-doctor", ["--dpms", "show"]);
      if (kdoc !== null) {
        const out = kdoc.split("\n")[0].split(" ");
        return out.pop().toUpperCase();
      }
      break;
    case "xset":
      const xset = execSyncCommand("xset", ["-q"]);
      if (xset !== null) {
        const on = /Monitor is On/.test(xset);
        return on ? "ON" : "OFF";
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
 * Gets the maximum display brightness value using `/sys/class/backlight/.../max_brightness`.
 *
 * @returns {number|null} The brightness maximum value or null if an error occurs.
 */
const getDisplayBrightnessMax = () => {
  if (!HARDWARE.display.brightness.path) {
    return null;
  }
  const max = fs.readFileSync(`${HARDWARE.display.brightness.path}/max_brightness`, "utf8").trim();
  if (max) {
    return parseInt(max, 10);
  }
  return null;
};

/**
 * Gets the current display brightness level using `/sys/class/backlight/.../brightness`.
 *
 * @returns {number|null} The brightness level as a percentage or null if an error occurs.
 */
const getDisplayBrightness = () => {
  if (!HARDWARE.support.displayBrightness) {
    return null;
  }
  const brightness = fs.readFileSync(`${HARDWARE.display.brightness.path}/brightness`, "utf8").trim();
  if (brightness) {
    const max = HARDWARE.display.brightness.max || 1;
    return Math.max(1, Math.min(Math.round((parseInt(brightness, 10) / max) * 100), 100));
  }
  return null;
};

/**
 * Sets the display brightness level using `/sys/class/backlight/.../brightness`.
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
  const max = HARDWARE.display.brightness.max || 1;
  const value = Math.max(1, Math.min(Math.round((brightness / 100) * max), max));
  const proc = execAsyncCommand("sudo", ["tee", `${HARDWARE.display.brightness.path}/brightness`], callback);
  proc.stdin.write(value.toString());
  proc.stdin.end();
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
  execAsyncCommand("sudo", ["reboot"], callback);
};

/**
 * Checks if a process is running using `pidof`.
 *
 * @param {string} name - The process name to check.
 * @returns {bool} Returns true if the process runs.
 */
const processRuns = (name) => {
  try {
    return !!cpr.execSync(`pidof ${name}`, { encoding: "utf8" });
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
    return !!cpr.execSync(`which ${name}`, { encoding: "utf8" });
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
const execSyncCommand = (cmd, args = []) => {
  try {
    const output = cpr.execSync([cmd, ...args].join(" "), { encoding: "utf8" });
    return output.trim().replace(/\0/g, "");
  } catch (error) {
    console.error("Execute Sync:", error.message);
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
const execAsyncCommand = (cmd, args = [], callback = null) => {
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
    try {
      if (typeof callback === "function") {
        if (code === 0) {
          callback(successOutput.trim().replace(/\0/g, ""), null);
        } else {
          callback(null, errorOutput.trim().replace(/\0/g, ""));
        }
      }
    } catch (error) {
      console.error("Execute Async:", error.message);
      if (typeof callback === "function") {
        callback(null, error.message);
      }
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
    const output = cpr.execSync([cmd, ...args].join(" ").trim(), { encoding: "utf8" });
    if (typeof callback === "function") {
      callback(output.trim().replace(/\0/g, ""), null);
    }
  } catch (error) {
    console.error("Call D-Bus:", error.message);
    if (typeof callback === "function") {
      callback(null, error.message);
    }
  }
};

/**
 * Monitors D-Bus property changes asynchronously using `dbus-monitor`.
 *
 * @param {string} path - The D-Bus object path.
 * @param {Function} callback - A callback function that receives the changed property.
 * @returns {Object} The spawned process object.
 */
const dbusMonitor = (path, callback) => {
  const cmd = "dbus-monitor";
  const args = [`interface='org.freedesktop.DBus.Properties',member='PropertiesChanged',path='${path}'`];
  const proc = cpr.spawn(cmd, args);
  proc.stdout.on("data", (data) => {
    try {
      const signal = data.toString();
      if (signal.includes("member=PropertiesChanged") && signal.includes(`path=${path}`)) {
        const dicts = [...signal.matchAll(/dict entry\(\s*([^)]*?)\)/g)].map((dict) => dict[1].trim());
        if (dicts.length) {
          dicts.forEach((dict) => {
            const key = dict.match(/string "(.*?)"/);
            const value = dict.match(/(?<=variant\s+)(.*)/);
            if (key && value && typeof callback === "function") {
              callback({ [key[1].trim()]: value[1].trim().split(" ").pop() }, null);
            }
          });
        } else {
          callback({ Visible: `${HARDWARE.keyboard.visibility}` }, null);
        }
      }
    } catch (error) {
      console.error("Monitor D-Bus:", error.message);
      if (typeof callback === "function") {
        callback(null, error.message);
      }
    }
  });
  proc.stderr.on("data", (data) => {
    if (data) {
      console.error("Monitor D-Bus:", data.toString());
      if (typeof callback === "function") {
        callback(null, data.toString());
      }
    }
  });
  return proc;
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
        console.error("Interval Callback:", error.message);
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
  getKeyboardVisibility,
  setKeyboardVisibility,
  checkPackageUpgrades,
  shutdownSystem,
  rebootSystem,
};
