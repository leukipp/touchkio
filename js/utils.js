const fs = require("fs");
const cpr = require("child_process");

/**
 * Checks if `sudo` commands can run without a password.
 *
 * @returns {boolean} True if password-less sudo rights exist.
 */
const sudoRights = () => {
  try {
    cpr.execSync(`sudo -n true`, { encoding: "utf8", stdio: "ignore" });
    return true;
  } catch {}
  return false;
};

/**
 * Checks if a file path has read access rights.
 *
 * @param {string} path - The file path to check.
 * @returns {boolean} True if read access rights exist.
 */
const readRights = (path) => {
  try {
    fs.accessSync(path, fs.constants.R_OK);
    return true;
  } catch {}
  return false;
};

/**
 * Checks if a file path has write access rights.
 *
 * @param {string} path - The file path to check.
 * @returns {boolean} True if write access rights exist.
 */
const writeRights = (path) => {
  try {
    fs.accessSync(path, fs.constants.R_OK | fs.constants.W_OK);
    return true;
  } catch {}
  return false;
};

/**
 * Checks if a command is available using `which`.
 *
 * @param {string} name - The command name to check.
 * @returns {boolean} True if the command is available.
 */
const commandExists = (name) => {
  try {
    cpr.execSync(`which ${name}`, { encoding: "utf8", stdio: "ignore" });
    return true;
  } catch {}
  return false;
};

module.exports = {
  sudoRights,
  readRights,
  writeRights,
  commandExists,
};
