const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const readline = require("readline/promises");
const integration = require("./src/integration");
const hardware = require("./src/hardware");
const webview = require("./src/webview");
const { app } = require("electron");

global.ARGS = global.ARGS || {};

if (!process.env.DISPLAY) {
  console.error(`$DISPLAY variable not set to run the GUI application, are you connected via SSH?`);
  console.error(`If you have installed the service use:`);
  console.error(`  systemctl --user start touchkio.service`);
  console.error(`Alternatively export the variables first:`);
  console.error(`  export DISPLAY=":0" && export WAYLAND_DISPLAY="wayland-0" && touchkio\n`);
}

/**
 * This promise resolves when the app has finished initializing,
 * allowing to safely create browser windows and perform other
 * initialization tasks.
 */
app.whenReady().then(async () => {
  const lock = app.requestSingleInstanceLock();
  if (!lock) {
    console.error("TouchKio is already running");
    return app.quit();
  }
  let args = parseArgs(process);
  let argsProvided = !!Object.keys(args).length;

  let argsFilePath = path.join(app.getPath("userData"), "Arguments.json");
  let argsFileExists = fs.existsSync(argsFilePath);

  // Setup arguments from file path
  if ("setup" in args || (!argsProvided && !argsFileExists)) {
    await sleep(3000);
    do {
      args = await promptArgs(process);
    } while (!Object.keys(args).length);
    writeArgs(argsFilePath, args);
  } else if (!argsProvided && argsFileExists) {
    args = readArgs(argsFilePath);
  }
  global.ARGS = args;

  // Show used arguments
  console.log(`Arguments: ${JSON.stringify(global.ARGS, null, 2)}`);

  // Chained init functions
  const chained = [webview.init, hardware.init, integration.init];
  for (const init of chained) {
    if (!(await init())) {
      break;
    }
  }
});

/**
 * Parses command-line arguments from the given process object.
 *
 * @param {Object} proc - The process object.
 * @returns {Object} An object mapping argument names to their corresponding values.
 */
const parseArgs = (proc) => {
  let args = {};
  proc.argv.slice(1).forEach((arg) => {
    if (arg !== ".") {
      const [key, value] = /^(.*?)=(.*)$/.exec(arg).slice(1);
      args[key.replace("--", "").replace("-", "_")] = value;
    }
  });
  return args;
};

/**
 * Prompts argument values on the command-line.
 *
 * @param {Object} proc - The process object.
 * @returns {Object} An object mapping argument names to their corresponding values.
 */
const promptArgs = async (proc) => {
  const read = readline.createInterface({
    input: proc.stdin,
    output: proc.stdout,
  });

  // Array of prompts
  const prompts = [
    {
      key: "web_url",
      question: "\nEnter WEB url",
      fallback: "http://192.168.1.42:8123",
    },
    {
      key: "web_theme",
      question: "Enter WEB theme",
      fallback: "dark",
    },
    {
      key: "web_zoom",
      question: "Enter WEB zoom level",
      fallback: "1.25",
    },
    {
      key: "web_widget",
      question: "Enter WEB widget enabled",
      fallback: "true",
    },
    {
      key: "mqtt",
      question: "\nConnect to MQTT Broker?",
      fallback: "y/N",
    },
    {
      key: "mqtt_url",
      question: "\nEnter MQTT url",
      fallback: "mqtt://192.168.1.42:1883",
    },
    {
      key: "mqtt_user",
      question: "Enter MQTT username",
      fallback: "kiosk",
    },
    {
      key: "mqtt_password",
      question: "Enter MQTT password",
      fallback: "password",
    },
    {
      key: "mqtt_discovery",
      question: "Enter MQTT discovery prefix",
      fallback: "homeassistant",
    },
    {
      key: "check",
      question: "\nEverything looks good?",
      fallback: "Y/n",
    },
  ];

  // Prompt questions and wait for the answers
  let args = {};
  let ignore = [];
  for (const { key, question, fallback } of prompts) {
    if (key === "mqtt") {
      const prompt = `${question} (${fallback}): `;
      const answer = await read.question(prompt);
      const value = (answer.trim() || fallback.match(/[YN]/)[0]).toLowerCase();
      if (!["y", "yes"].includes(value)) {
        ignore = ignore.concat(["mqtt_url", "mqtt_user", "mqtt_password", "mqtt_discovery"]);
      }
    } else if (key === "check") {
      const json = JSON.stringify(args, null, 2);
      const prompt = `${question}\n${json}\n(${fallback}): `;
      const answer = await read.question(prompt);
      const value = (answer.trim() || fallback.match(/[YN]/)[0]).toLowerCase();
      if (!["y", "yes"].includes(value)) {
        args = {};
      }
    } else if (!ignore.includes(key)) {
      const prompt = `${question} (${fallback}): `;
      const answer = await read.question(prompt);
      const value = answer.trim() || fallback;
      args[key] = value;
    }
  }
  read.close();

  return args;
};

/**
 * Writes argument values to the filesystem.
 *
 * @param {string} path - Path of the .json file.
 * @param {Object} args - The arguments object.
 */
const writeArgs = (path, args) => {
  const argc = Object.assign({}, args);
  if ("mqtt_password" in argc) {
    argc.mqtt_password = encrypt(argc.mqtt_password);
  }
  fs.writeFileSync(path, JSON.stringify(argc, null, 2));
};

/**
 * Reads argument values from the filesystem.
 *
 * @param {string} path - Path of the .json file.
 * @returns {Object} The arguments object.
 */
const readArgs = (path) => {
  const args = JSON.parse(fs.readFileSync(path));
  if ("mqtt_password" in args) {
    args.mqtt_password = decrypt(args.mqtt_password);
  }
  return args;
};

/**
 * Helper function for string encryption.
 *
 * @param {string} value - Plain text value.
 * @returns {string} Encrypted value.
 */
const encrypt = (value) => {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(hardware.getMachineId(), app.getName(), 32);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(value, "utf8", "hex");
  encrypted += cipher.final("hex");
  return Buffer.from(iv.toString("hex") + ":" + encrypted).toString("base64");
};

/**
 * Helper function for string decryption.
 *
 * @param {string} value - Encrypted value.
 * @returns {string} Plain text value.
 */
const decrypt = (value) => {
  const p = Buffer.from(value, "base64").toString("utf8").split(":");
  const iv = Buffer.from(p.shift(), "hex");
  const key = crypto.scryptSync(hardware.getMachineId(), app.getName(), 32);
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  const buffer = Buffer.from(p.join(":"), "hex");
  let decrypted = decipher.update(buffer, "binary", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
};

/**
 * Helper function for asynchronous sleep.
 *
 * @param {number} ms - Sleep time in milliseconds.
 * @returns {Promise} A promise resolving after the timeout.
 */
const sleep = (ms) => {
  return new Promise((r) => setTimeout(r, ms));
};
