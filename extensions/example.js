/**
 * Example extension that publishes a counter sensor and a reset button via MQTT.
 *
 * Copy this file into the `~/.config/touchkio/extensions` folder and restart the app.
 */
let counter = 0;

module.exports = {
  /**
   * Called on startup.
   *
   * @param {Object} api - The extension api object.
   * @returns {Promise<void>}
   */
  init: async (api) => {
    console.info(`Extension ${api.name} loaded from ${api.path}`);
  },

  /**
   * Called once MQTT is connected.
   *
   * @param {Object} api - The extension api object.
   * @returns {Promise<void>}
   */
  initIntegration: async (api) => {
    api.integration.publishConfig("sensor", "example_counter", {
      name: "Example Counter",
      icon: "mdi:counter",
    });
    api.integration.publishState("example_counter", counter);

    api.integration.publishConfig("button", "example_reset", {
      name: "Example Reset",
      icon: "mdi:restore",
    });
    api.integration.subscribe("example_reset", () => {
      counter = 0;
      api.integration.publishState("example_counter", counter);
    });
  },

  /**
   * Called every minute.
   *
   * @param {Object} api - The extension api object.
   * @returns {Promise<void>}
   */
  update: async (api) => {
    counter++;
    if (api.integration.client) {
      api.integration.publishState("example_counter", counter);
    }
  },
};
