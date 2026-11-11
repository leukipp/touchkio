const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");
const utils = require("./utils");
const hardware = require("./hardware");
const integration = require("./integration");

global.EXTENSIONS = global.EXTENSIONS || {
  initialized: false,
  path: null,
  loaded: [],
  entities: new Map(),
};

/**
 * Initializes the extensions found in the extensions folder.
 *
 * @returns {Promise<boolean>} True if the initialization was successful.
 */
const init = async () => {
  if (ARGS.app_disable.includes("extensions")) {
    return false;
  }

  // Resolve extensions folder
  EXTENSIONS.path = path.resolve(ARGS.app_extensions || path.join(APP.config, "extensions"));
  if (!fs.existsSync(EXTENSIONS.path)) {
    console.debug(`extensions.js: init() --> ${EXTENSIONS.path} not found`);
    return true;
  }

  // Load extension modules
  for (const entry of fs.readdirSync(EXTENSIONS.path).sort()) {
    const name = entry.replace(/\.js$/, "");
    if (/^[._]/.test(entry) || ARGS.app_disable.includes(`ext_${name}`)) {
      continue;
    }
    const file = path.join(EXTENSIONS.path, entry);
    try {
      const directory = fs.statSync(file).isDirectory();
      if (!directory && !entry.endsWith(".js")) {
        continue;
      }
      const dir = directory ? file : EXTENSIONS.path;
      EXTENSIONS.loaded.push({ name, extension: require(file), api: createApi(name, dir) });
    } catch (error) {
      console.error(`Extension ${name} failed:`, error.message);
    }
  }
  console.info(`Extensions [${EXTENSIONS.path}]:`, EXTENSIONS.loaded.map((e) => e.name).join(", ") || "none");
  process.stdout.write("\n");

  // Init extensions
  await call("init");
  EXTENSIONS.initialized = true;

  // Init extensions integration
  if (INTEGRATION.initialized) {
    await call("initIntegration");
  } else {
    EVENTS.once("initIntegration", () => call("initIntegration"));
  }

  // Update extensions periodically (1min)
  setInterval(() => {
    if (APP.exiting) {
      return;
    }
    update();
  }, 60 * 1000);

  return true;
};

/**
 * Updates the loaded extensions.
 *
 * @returns {Promise<void>}
 */
const update = async () => {
  if (!EXTENSIONS.initialized || APP.exiting) {
    return;
  }
  console.debug("extensions.js: update()");

  await call("update");
};

/**
 * Calls the given method on all loaded extensions.
 *
 * @param {string} method - The method name.
 * @returns {Promise<void>}
 */
const call = async (method) => {
  for (const { name, extension, api } of EXTENSIONS.loaded) {
    if (typeof extension[method] !== "function") {
      continue;
    }
    try {
      await extension[method](api);
    } catch (error) {
      console.error(`Extension ${name} ${method}() failed:`, error.message);
    }
  }
};

/**
 * Claims an entity id for an extension, so it can't overwrite entities of the app or other extensions.
 *
 * @param {string} name - The extension name.
 * @param {string} id - The entity id.
 * @returns {void}
 */
const claim = (name, id) => {
  const owner = EXTENSIONS.entities.get(id) || (INTEGRATION.entities.has(id) ? APP.title : null);
  if (owner && owner !== name) {
    throw new Error(`Entity '${id}' is already used by ${owner}`);
  }
  EXTENSIONS.entities.set(id, name);
};

/**
 * Creates the api object that is passed to the extension methods.
 *
 * @param {string} name - The extension name.
 * @param {string} dir - The extension folder.
 * @returns {Object} The api object.
 */
const createApi = (name, dir) => {
  const commands = {};
  return {
    name: name,
    path: dir,
    app: APP,
    args: ARGS,
    events: EVENTS,
    utils: utils,
    hardware: hardware,
    integration: {
      publishConfig: (type, id, config = {}) => {
        claim(name, id);
        const root = `${INTEGRATION.root}/${id}`;
        const topics = type === "button" ? { command_topic: `${root}/execute` } : { state_topic: `${root}/state` };
        if (["switch", "number", "select", "text"].includes(type)) {
          topics.command_topic = `${root}/set`;
        }
        config = { unique_id: `${INTEGRATION.node}_${id}`, ...topics, device: INTEGRATION.device, ...config };
        commands[id] = config.command_topic;
        return integration.publishConfig(type, config);
      },
      removeConfig: (type, id) => {
        claim(name, id);
        return integration.removeConfig(type, { unique_id: `${INTEGRATION.node}_${id}` });
      },
      publishState: (id, state, retain = true) => {
        claim(name, id);
        return integration.publishState(id, state, retain);
      },
      publishAttributes: (id, attributes, retain = true) => {
        claim(name, id);
        return integration.publishAttributes(id, attributes, retain);
      },
      subscribe: (id, callback) => {
        claim(name, id);
        const topic = commands[id] || `${INTEGRATION.root}/${id}/set`;
        return INTEGRATION.client
          .on("message", (t, message) => {
            if (t === topic) {
              Promise.resolve()
                .then(() => callback(message.toString()))
                .catch((error) => console.error(`Extension ${name} subscribe(${id}) failed:`, error.message));
            }
          })
          .subscribe(topic);
      },
      get client() {
        return INTEGRATION.client;
      },
      get device() {
        return INTEGRATION.device;
      },
      get node() {
        return INTEGRATION.node;
      },
      get root() {
        return INTEGRATION.root;
      },
      get discovery() {
        return INTEGRATION.discovery;
      },
    },
    require: createRequire(path.join(APP.path, "package.json")),
  };
};

module.exports = {
  init,
  update,
};
