const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const readline = require("readline/promises");
const integration = require("./js/integration");
const hardware = require("./js/hardware");
const webview = require("./js/webview");
const log = require("electron-log");
const { app } = require("electron");
const Events = require("events");

global.APP = global.APP || {};
global.ARGS = global.ARGS || {};
global.EVENTS = global.EVENTS || new Events();

if (!process.env.DISPLAY) {
  console.error(`\n$DISPLAY variable not set to run the GUI application, are you connected via SSH?\n`);
  console.error(`If you have installed the service use:`);
  console.error(`  systemctl --user start touchkio.service`);
  console.error(`Alternatively export the variables first:`);
  console.error(`  export DISPLAY=":0" && export WAYLAND_DISPLAY="wayland-0" && touchkio\n`);
  process.exit(1);
}

/**
 * This promise resolves when the app has finished initializing,
 * allowing to safely create browser windows and perform other
 * initialization tasks.
 */
app.whenReady().then(async () => {
  if (!(await initApp()) || !(await initArgs()) || !(await initLog())) {
    return;
  }

  // Show used arguments
  const args = Object.assign({}, ARGS);
  if ("mqtt_password" in args) {
    args.mqtt_password = "*".repeat((args.mqtt_password || "").length);
  }
  console.log(`Arguments: ${JSON.stringify(args, null, 2)}`);

  // Chained init functions
  const chained = [webview.init, hardware.init, integration.init];
  for (const init of chained) {
    if (!(await init())) {
      break;
    }
  }
});

/**
 * Initializes the global app object.
 *
 * @returns {bool} Returns true if the initialization was successful.
 */
const initApp = async () => {
  const packageJsonPath = path.join(app.getAppPath(), "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  const buildJsonPath = path.join(app.getAppPath(), "build.json");
  const buildFileExists = fs.existsSync(buildJsonPath);

  // Set required app infos
  APP.name = app.getName();
  APP.title = packageJson.title;
  APP.version = app.getVersion();
  APP.path = app.getAppPath();
  APP.config = app.getPath("userData");
  APP.log = path.join(app.getPath("logs"), "main.log");

  // Set additional update infos
  APP.homepage = `https://github.com/${packageJson.author}/${packageJson.name}`;
  APP.releases = {
    url: `https://api.github.com/repos/${packageJson.author}/${packageJson.name}/releases`,
    latest: null,
  };
  APP.scripts = {
    install: `https://raw.githubusercontent.com/${packageJson.author}/${packageJson.name}/main/install.sh`,
  };

  // Set additional build infos
  APP.build = {};
  if (buildFileExists) {
    APP.build = JSON.parse(fs.readFileSync(buildJsonPath, "utf8"));
  }

  // Request single app instance lock
  if (!app.requestSingleInstanceLock()) {
    console.error(`${APP.title} is already running`);
    return app.exit(1);
  }

  return true;
};

/**
 * Initializes the global args object.
 *
 * @returns {bool} Returns true if the initialization was successful.
 */
const initArgs = async () => {
  let args = parseArgs(process);
  let argsProvided = !!Object.keys(args).length;

  let argsFilePath = path.join(APP.config, "Arguments.json");
  let argsFileExists = fs.existsSync(argsFilePath);

  // Show version and release info
  if ("help" in args || "version" in args) {
    let build = "";
    if (APP.build.id) {
      build = ` (${APP.build.id}), built on ${APP.build.date} (${APP.build.platform}-${APP.build.arch}-${APP.build.maker})`;
    }
    console.log(`${APP.name}-v${APP.version}${build}\n${APP.homepage}`);
    return app.exit(0);
  }

  // Setup arguments from file path
  if ((!argsProvided && !argsFileExists) || "setup" in args) {
    await sleep(3000);
    do {
      args = await promptArgs(process);
    } while (!Object.keys(args).length);
    writeArgs(argsFilePath, args);
  } else if (argsFileExists) {
    args = { ...readArgs(argsFilePath), ...args };
  }

  // Check arguments object
  if (!Object.keys(args).length) {
    console.error(`No arguments provided`);
    return app.exit(1);
  }

  // Split url arguments
  args.web_url = args.web_url || [];
  if (!Array.isArray(args.web_url)) {
    args.web_url = args.web_url.split(",").map((url) => url.trim());
  }
  ARGS = args;

  return true;
};

/**
 * Initializes the global log object.
 *
 * @returns {bool} Returns true if the initialization was successful.
 */
const initLog = async () => {
  try {
    if (fs.existsSync(APP.log)) {
      fs.unlinkSync(APP.log);
    }
  } catch (error) {
    console.error("Failed to delete log file:", error.message);
  }

  // Overwrite console log settings
  log.transports.file.resolvePathFn = () => {
    return APP.log;
  };
  Object.assign(console, log.functions);

  return true;
};

/**
 * Parses command-line arguments from the given process object.
 *
 * @param {Object} proc - The process object.
 * @returns {Object} An object mapping argument names to their corresponding values.
 */
const parseArgs = (proc) => {
  const args = proc.argv.slice(1).filter((arg) => arg !== ".");
  return Object.fromEntries(
    args.flatMap((arg) => {
      const match = arg.match(/^--?([^=]+)(?:=(.*))?$/);
      return match ? [[match[1].replace(/-/g, "_"), match[2] ?? null]] : [];
    }),
  );
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
  try {
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
        if (key === "web_url") {
          args[key] = value.split(",").map((v) => v.trim());
        } else {
          args[key] = value;
        }
      }
    }
  } catch (error) {
    console.error(`\n${error.message}`);
    args = {};
    app.exit(1);
  } finally {
    read.close();
  }

  return args;
};

/**
 * Writes argument values to the filesystem.
 *
 * @param {string} path - Path of the .json file.
 * @param {Object} args - The arguments object.
 */
const writeArgs = (path, args) => {
  try {
    const argc = Object.assign({}, args);
    if ("mqtt_password" in argc) {
      argc.mqtt_password = encrypt(argc.mqtt_password);
    }
    fs.writeFileSync(path, JSON.stringify(argc, null, 2));
  } catch (error) {
    console.error(`Failed to write ${path}:`, error.message);
  }
};

/**
 * Reads argument values from the filesystem.
 *
 * @param {string} path - Path of the .json file.
 * @returns {Object} The arguments object.
 */
const readArgs = (path) => {
  try {
    const args = JSON.parse(fs.readFileSync(path, "utf8"));
    if ("mqtt_password" in args) {
      args.mqtt_password = decrypt(args.mqtt_password);
    }
    return args;
  } catch (error) {
    console.error(`Failed to parse ${path}:`, error.message);
  }
  return {};
};

/**
 * Helper function for string encryption.
 *
 * @param {string} value - Plain text value.
 * @returns {string} Encrypted value.
 */
const encrypt = (value) => {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(hardware.getMachineId(), APP.name, 32);
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
  const key = crypto.scryptSync(hardware.getMachineId(), APP.name, 32);
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
