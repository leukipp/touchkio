const os = require("os");
const fs = require("fs");
const process = require("child_process");

global.HARDWARE = global.HARDWARE || {
  initialized: false,
  status: "invalid",
  display: {
    status: null,
    brightness: null,
    notifiers: [],
  },
};

/**
 * Initializes the hardware with the provided arguments.
 *
 * @param {Object} args - The command-line arguments to customize the initialization process.
 * @returns {boolean} Returns true if the initialization was successful.
 */
const init = async (args) => {
  if (!args.mqtt_url) {
    return false;
  }

  // Check supported hardware
  if (!hardwareExists()) {
    console.warn("Hardware not supported");
    return false;
  }

  // Check supported model
  const model = getModel();
  if (!model || !model.includes("Raspberry Pi")) {
    console.warn(`Device ${model} not supported`);
    return false;
  }

  console.log("\nModel:", getModel());
  console.log("Serial Number:", getSerialNumber());
  console.log("Host Name:", getHostName());
  console.log("Up Time:", getUpTime());
  console.log("Memory Size:", getMemorySize());
  console.log("Memory Usage:", getMemoryUsage());
  console.log("Processor Usage:", getProcessorUsage());
  console.log("Processor Temperature:", getProcessorTemperature());
  // Commented out for Pi 4 testing purposes as of 05.01.2025 - 17:15
  // console.log("Display Status:", getDisplayStatus());
  // console.log("Display Brightness:", getDisplayBrightness(), "\n");


  // Init globals
  HARDWARE.initialized = true;
  HARDWARE.status = "valid";

  // Check for display changes
  setInterval(update, 500);

  return true;
};

/**
 * Updates the shared hardware properties.
 */
const update = () => {
  if (!HARDWARE.initialized) {
    return;
  }
  
  // commented out for testing Pi 4 as of 05.01.2025 - 17:19
  /*
  const path = "/sys/class/backlight/10-0045";

  // Display status has changed
  const status = fs.readFileSync(`${path}/bl_power`, "utf8").trim();
  if (status !== HARDWARE.display.status) {
    console.log("Update Display Status:", getDisplayStatus());
    HARDWARE.display.status = status;
    HARDWARE.display.notifiers.forEach((notifier) => {
      notifier();
    });
  }

  // Display brightness has changed
  const brightness = fs.readFileSync(`${path}/brightness`, "utf8").trim();
  if (brightness !== HARDWARE.display.brightness) {
    console.log("Update Display Brightness:", getDisplayBrightness());
    HARDWARE.display.brightness = brightness;
    HARDWARE.display.notifiers.forEach((notifier) => {
      notifier();
    });
  }
  */
};

/**
 * Verifies hardware compatibility by checking the presence of necessary sys files.
 *
 * @returns {bool} Returns true if all files exists.
 */
const hardwareExists = () => {
  const files = [
    "/sys/firmware/devicetree/base/model",
    "/sys/firmware/devicetree/base/serial-number",
    // Uncommented for testing purposes as of 05.01.2025 - 16:57
    // "/sys/class/backlight/10-0045/brightness",
    // "/sys/class/backlight/10-0045/bl_power",
  ];
  return files.every((file) => fs.existsSync(file));
};

/**
 * Gets the Raspberry Pi model name using `/sys/firmware/devicetree/base/model`.
 *
 * @returns {string|null} The model of the Raspberry Pi or null if an error occurs.
 */
const getModel = () => {
  return execSyncCommand("cat", ["/sys/firmware/devicetree/base/model"]);
};

/**
 * Gets the Raspberry Pi serial number using `/sys/firmware/devicetree/base/serial-number`.
 *
 * @returns {string|null} The serial number of the Raspberry Pi or null if an error occurs.
 */
const getSerialNumber = () => {
  return execSyncCommand("cat", [
    "/sys/firmware/devicetree/base/serial-number",
  ]);
};

/**
 * Gets the host machine id using `/etc/machine-id`.
 *
 * @returns {string|null} The machine id of the system.
 */
const getMachineId = () => {
  return execSyncCommand("cat", ["/etc/machine-id"]);
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
 * Gets the current CPU temperature using `vcgencmd measure_temp`.
 *
 * @returns {number|null} The CPU temperature in degrees Celsius or null if an error occurs.
 */
const getProcessorTemperature = () => {
  const output = execSyncCommand("vcgencmd", ["measure_temp"]);
  if (output !== null) {
    const temp = output.match(/temp=(\d+\.\d+)/);
    if (temp && temp[1]) {
      return parseFloat(temp[1]);
    }
  }
  return null;
};

/**
 * Gets the current display power status using `wlopm`.
 *
 * @returns {string|null} The output of the command or null if an error occurs.
 */
const getDisplayStatus = () => {
  const status = execSyncCommand("wlopm", []);
  if (status !== null) {
    return status.slice(status.lastIndexOf(" ") + 1).toUpperCase();
  }
  return null;

  /* This also works, but it's better to use `wlopm` for getter and setter methods.
  const status = execSyncCommand("cat", [
    "/sys/class/backlight/10-0045/bl_power",
  ]);
  if (status !== null) {
    return status === "0" ? "ON" : "OFF";
  }
  */
};

/**
 * Sets the display power status using `wlopm`.
 *
 * This function takes a desired status ('ON' or 'OFF') and executes
 * the appropriate command to set the display status.
 *
 * @param {string} status - The desired status ('ON' or 'OFF').
 * @param {function} callback - A callback function that receives the output or error.
 */
const setDisplayStatus = (status, callback = null) => {
  if (status !== "ON" && status !== "OFF") {
    console.error("Status must be 'ON' or 'OFF'");
    if (typeof callback === "function") callback(null, "Invalid status");
    return;
  }
  const args = status === "ON" ? ["--on", "*"] : ["--off", "*"];
  execAsyncCommand("wlopm", args, callback);

  /* This also works, but interferes with the built-in screen blanking function.
  const value = status === "ON" ? "0" : "4";
  const proc = execAsyncCommand(
    "tee",
    ["/sys/class/backlight/10-0045/bl_power"],
    callback
  );
  proc.stdin.write(value.toString());
  proc.stdin.end();
  */
};

/**
 * Gets the current display brightness level using `/sys/class/backlight/10-0045/brightness`.
 *
 * This function retrieves the brightness level, which is in the range of 0-31,
 * and maps it to a percentage in the range of 0-100 percent.
 *
 * @returns {number|null} The brightness level as a percentage or null if an error occurs.
 */
const getDisplayBrightness = () => {
  const brightness = execSyncCommand("cat", [
    "/sys/class/backlight/10-0045/brightness",
  ]);
  if (brightness !== null) {
    return Math.round((parseInt(brightness, 10) / 31) * 100);
  }
  return null;
};

/**
 * Sets the display brightness level using `/sys/class/backlight/10-0045/brightness`.
 *
 * This function takes a brightness value in the range of 1-100 percent,
 * maps it to the range of 0-31, and writes it to the system.
 *
 * @param {number} brightness - The desired brightness level (1-100).
 * @param {function} callback - A callback function that receives the output or error.
 */
const setDisplayBrightness = (brightness, callback = null) => {
  if (typeof brightness !== "number" || brightness < 1 || brightness > 100) {
    console.error("Brightness must be a number between 1 and 100");
    if (typeof callback === "function") callback(null, "Invalid brightness");
    return;
  }
  const value = Math.max(1, Math.min(Math.round((brightness / 100) * 31), 31));
  const proc = execAsyncCommand(
    "tee",
    ["/sys/class/backlight/10-0045/brightness"],
    callback
  );
  proc.stdin.write(value.toString());
  proc.stdin.end();
};

/**
 * Shuts down the system using `sudo shutdown -h now`.
 *
 * This function executes the command asynchronously.
 * The output of the command will be provided through the callback function.
 *
 * @param {function} callback - A callback function that receives the output or error.
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
 * @param {function} callback - A callback function that receives the output or error.
 */
const rebootSystem = (callback = null) => {
  execAsyncCommand("sudo", ["reboot"], callback);
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
    const output = process.execSync([cmd, ...args].join(" "), {
      encoding: "utf8",
    });
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
 * @param {function} callback - A callback function that receives the output or error.
 * @returns {object} The spawned process object.
 */
const execAsyncCommand = (cmd, args = [], callback = null) => {
  let errorOutput = "";
  let successOutput = "";
  let proc = process.spawn(cmd, args);
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
    }
  });
  return proc;
};

module.exports = {
  init,
  update,
  getModel,
  getSerialNumber,
  getMachineId,
  getHostName,
  getUpTime,
  getMemorySize,
  getMemoryUsage,
  getProcessorUsage,
  getProcessorTemperature,
  getDisplayStatus,
  setDisplayStatus,
  getDisplayBrightness,
  setDisplayBrightness,
  shutdownSystem,
  rebootSystem,
};
