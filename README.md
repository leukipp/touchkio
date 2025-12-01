# TouchKio
[![build](https://img.shields.io/github/actions/workflow/status/leukipp/touchkio/release.yaml?style=flat-square)](https://github.com/leukipp/touchkio/actions)
[![date](https://img.shields.io/github/release-date/leukipp/touchkio?style=flat-square)](https://github.com/leukipp/touchkio/releases)
[![platform](https://img.shields.io/badge/platform-%20arm64%20|%20x64%20-teal?style=flat-square)](https://github.com/leukipp/touchkio/releases)
[![downloads](https://img.shields.io/github/downloads/leukipp/touchkio/total?style=flat-square)](https://github.com/leukipp/touchkio/releases)
[![sponsor](https://img.shields.io/github/sponsors/leukipp?color=red&logo=github&style=flat-square)](https://github.com/sponsors/leukipp)

**TouchKio** is a Node.js application that utilizes Electron to create a kiosk mode window specifically designed for a Home Assistant dashboard.
This tool is packaged as a **.deb** file, making it easy to launch the kiosk application on any Debian based Linux [hardware](https://github.com/leukipp/touchkio/blob/main/HARDWARE.md) (e.g. **Raspberry Pi**) equipped with a **DSI or HDMI** Touch Display.
Additional releases for other Linux systems are available as **.zip** file.

[![display](https://raw.githubusercontent.com/leukipp/touchkio/main/img/display.png)](https://github.com/leukipp/touchkio/blob/main/img/display.png)

This implementation addresses common issues encountered when using the built-in browser running in fullscreen mode on a Linux device with Touch Display.
Moreover, the device running the **kiosk application** also offers several **Home Assistant MQTT** sensors, enhancing it's functionality for automation purposes.

## Features
- [x] Fast and easy setup.
- [x] Remember login credentials.
- [x] Touch optimized web browsing.
- [x] Dynamic window status bar layout.
- [x] Side panel widget for kiosk control.
- [x] Navigation bar to switch between pages.
- [x] Adjustable browser zoom and theme support.
- [x] Extended touch screen wake-up functionality.
- [x] Remote controllable via MQTT.
  - [x] Toggle the on-screen keyboard.
  - [x] Touch display power and brightness.
  - [x] Manage kiosk window status and zoom.
  - [x] Screenshot image of the kiosk webview.
  - [x] Show network interfaces and addresses.
  - [x] List all available system package upgrades.
  - [x] Multi-webpage switching and url navigation.
  - [x] Volume control for connected audio outputs.
  - [x] Execute system reboot and shutdown commands.
  - [x] Monitor battery, temperature, processor and memory usage.

The kiosk application can be executed with command line arguments to load a **Home Assistant dashboard in fullscreen** mode.
Additionally, a **MQTT endpoint** can be defined, allowing the application to provide controls and sensors for the Linux device and the connected Touch Display.

## Setup
Before you begin, make sure that you have a Linux device configured and operational with a [compatible](https://github.com/leukipp/touchkio/blob/main/HARDWARE.md) Touch Display.
This guide assumes that you are using a Raspberry Pi with the latest version of Raspberry Pi OS **(64-bit)**, along with a desktop environment (preferred using **labwc**).
However, the **.deb** setup procedure is also compatible with any other Debian based 64-bit system.

### Optional
To utilize the sensor features of your device through Home Assistant, it's essential to have a **MQTT broker running** and the **MQTT integration installed** on your Home Assistant instance.
This setup allows seamless communication between your kiosk device and Home Assistant, enabling **real-time data exchange**.

[![mqtt](https://raw.githubusercontent.com/leukipp/touchkio/main/img/mqtt.png)](https://github.com/leukipp/touchkio/blob/main/img/mqtt.png)

For a comprehensive guide on setting up MQTT with Home Assistant, please refer to the official documentation available here: https://www.home-assistant.io/integrations/mqtt.

## Installation
On the first run of the application, you will encounter a **setup procedure (CLI)** and the Home Assistant **login screen (UI)**.
It's recommended to create a dedicated Home Assistant user (local access only) for your kiosk device.

You might also need a physical keyboard or remote VNC access to input these credentials once.
If your hardware is [supported](https://github.com/leukipp/touchkio/blob/main/HARDWARE.md) you may be able to activate the on-screen keyboard using the side [widget](https://github.com/leukipp/touchkio/issues/16).
After the first login the Home Assistant credentials should be stored inside the `~/.config/touchkio/Cache` folder.

#### Option 1 - The easy way
Run this command to download and install the latest **.deb** (arm64 or x64) release.
It will also create a systemd user file for auto-startup and will guide you through the setup process:
```bash
bash <(wget -qO- https://raw.githubusercontent.com/leukipp/touchkio/main/install.sh)
```
Make sure that you run this with your **standard user** and not with root (sudo).
If you are paranoid, or smart, or both, have a look into the [install.sh](https://github.com/leukipp/touchkio/blob/main/install.sh) script before executing external code on your machine.

The systemd **user service** is enabled by default and the kiosk application should start automatically the next time you boot.
If you need manual control use:
```bash
systemctl --user start|stop|status|restart touchkio.service
```

<details><summary>Alternatives</summary><div>

#### Option 2 - The standard way
When connected via SSH, it's necessary to export the display variables first, as outlined in the [development](https://github.com/leukipp/touchkio?tab=readme-ov-file#development) section.
The [install.sh](https://github.com/leukipp/touchkio/blob/main/install.sh) script mentioned above performs the following tasks (and you just have to do it manually):
- [Download](https://github.com/leukipp/touchkio/releases/latest) the latest version file that is suitable for your architecture (arm64 or x64).
  - Debian (**deb**): Open a terminal and execute the following command to install the application, e.g: `sudo apt install ./touchkio_1.x.x_arm64.deb && touchkio --setup`
  - Others (**zip**): Extract the archive and run the binary, e.g: `unzip touchkio-linux-x64-1.x.x.zip && cd touchkio-linux-x64 && ./touchkio --setup`
- If you just want to load a Home Assistant dashboard without further control you are good to go, e.g: `touchkio --web-url=https://demo.home-assistant.io`
  - The `--web-url` doesn't necessarily need to be a Home Assistant url, any kind of website can be shown in kiosk mode.
  - Only when using the MQTT integration via `--mqtt-*`, a running Home Assistant instance is required.
- If you need the application to be automatically started on boot, create a systemd file.

#### Option 3 - The hard way
Pre-built release files are available for arm64 and x64 Linux systems.
If you are using a different architecture, you can still utilize this repository to build your own application.

For more information please refer to the [development](https://github.com/leukipp/touchkio?tab=readme-ov-file#development) section, however this will do the job:
```bash
yarn build
```

</div></details>

#### Update
If you have already installed TouchKio and want to upgrade to the latest version, simply install the newer version over the existing one.

The [install.sh](https://github.com/leukipp/touchkio/blob/main/install.sh) script can also be run to update an existing installation to the **latest version**.
The setup procedure can be skipped to use the existing default arguments from the configuration file:
```bash
bash <(wget -qO- https://raw.githubusercontent.com/leukipp/touchkio/main/install.sh) update
```

## Configuration
Running `touchkio --setup` will prompt you to enter arguments that will be used when the application starts without any specified arguments.
These default arguments are stored in `~/.config/touchkio/Arguments.json`, where they can also be modified.

### WEB
The available arguments to control the kiosk application via terminal are as follows:
| Name                      | Default | Description                                                                                                |
| ------------------------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| `--web-url` (Required)    | -       | Url of the Home Assistant instance<a id="ref1"></a><sup><a href="#foot1">[1]</a></sup> (HTTP(S)://IP:PORT) |
| `--web-theme` (Optional)  | `dark`  | Theme settings of the web browser (`light` or `dark`)                                                      |
| `--web-zoom` (Optional)   | `1.25`  | Zoom settings of the web browser (`1.0` is `100%`)                                                         |
| `--web-widget` (Optional) | `true`  | Enables the sidebar widget (`true` or `false`)                                                             |

These arguments allow you to customize the appearance of the web browser view.

For example:
```bash
touchkio --web-url=http://192.168.1.42:8123 --web-theme=light --web-zoom=1.0
```

> <a id="foot1"></a><a href="#ref1">[1]</a>: This doesn't necessarily have to be a Home Assistant Url.
> You can configure multiple pages by separating them with a comma:
> `touchkio --web-url=https://demo.home-assistant.io,https://demo.immichkiosk.app`.

In the `~/.config/touchkio/Arguments.json` file:
```json
{
  "web_url": [
    "https://demo.home-assistant.io",
    "https://demo.immichkiosk.app"
  ]
}
```

### MQTT
To broadcast your local sensor data to Home Assistant, you can use the following arguments, which require a running MQTT broker:
| Name                          | Default         | Description                                                                              |
| ----------------------------- | --------------- | ---------------------------------------------------------------------------------------- |
| `--mqtt-url` (Required)       | -               | Url of the MQTT broker instance (MQTT(S)://IP:PORT)                                      |
| `--mqtt-user` (Required)      | -               | Username which is available in Home Assistant (e.g. create a user named `kiosk`)         |
| `--mqtt-password` (Required)  | -               | The password of the user (e.g. use `password`, because it's secure and easy to remember) |
| `--mqtt-discovery` (Optional) | `homeassistant` | The discovery prefix for MQTT (`homeassistant` works with default setups)                |

When you start the application with the MQTT arguments, the Home Assistant auto-discovery feature will automatically add controls and sensors that can be used for further integration.
You can find them under **Settings** -> **Devices and Services** -> **Devices** by searching for **TouchKio**.

For example:
```bash
touchkio --web-url=http://192.168.1.42:8123 --mqtt-url=mqtt://192.168.1.42:1883 --mqtt-user=kiosk --mqtt-password=password
```

## User Interface
TouchKio provides a simple webview window designed specifically for Touch Displays. Electron apps are known to be resource intensive due to their architecture and the inclusion of a full web browser environment. If you just run the kiosk application without other heavy loads, everything should run smoothly.

### Touch Controls
Additional controls can be found along the right edge of the kiosk application. For more details, you may want to have a closer look here:
| Name         | Description                                              |
| ------------ | -------------------------------------------------------- |
| `Widget`     | [See #16](https://github.com/leukipp/touchkio/issues/16) |
| `Navigation` | [See #45](https://github.com/leukipp/touchkio/issues/45) |
| `Pager`      | [See #64](https://github.com/leukipp/touchkio/issues/64) |


### Keyboard Shortcuts
The application also supports basic shortcuts to enhance navigation and usability for users who prefer or require non-touch input methods:
| Name                        | Description                  |
| --------------------------- | ---------------------------- |
| `Control+Left`              | Navigate to previous page    |
| `Control+Right`             | Navigate to next page        |
| `Control+Num_Subtract`      | Decrease the page zoom       |
| `Control+Num_Add`           | Increase the page zoom       |
| `Alt+Left`/`Mouse+Back`     | Navigate backward in history |
| `Alt+Right`/`Mouse+Forward` | Navigate forward in history  |

## Development
To create your own local build, you first need to install [Node.js](https://pimylifeup.com/raspberry-pi-nodejs) and [Yarn](https://classic.yarnpkg.com/lang/en/docs/install).

Clone this repository and run `yarn install` to install the dependencies.
Then use `yarn start` to execute the start script located in the [package.json](https://github.com/leukipp/touchkio/blob/main/package.json) file.
There you may want to adjust the `--web-url` and other arguments for development runs.

If you access your device over SSH, make sure to export the display variables so the kiosk application can launch in the desktop environment.
```bash
export DISPLAY=":0"
export WAYLAND_DISPLAY="wayland-0"
```
To make this permanent, consider adding the export variables into the `~/.bashrc` file.

### Extensions

<details><summary>You probably won't need this.</summary><div></br>

Incorporating custom extensions and external hardware (like motion sensors, ultrasonic sensors, cameras, relays and switches) via **Raspberry Pi's GPIO/USB** involves several steps.
While using external sensors that directly integrate with Home Assistant and by utilizing automation's to interact with **TouchKio via MQTT** is generally easier and **recommended**, here's a rough guide on how to proceed with custom hardware integration:

1. **Install Node.js library**: Use Yarn to add a library that can interact with your hardware (GPIO, USB, etc.):
    ```bash
    yarn add [package-name]
    ```
    This will update the `package.json` file with the required dependencies.

2. **Import the library**: Open the `hardware.js` file and import the library using:
    ```javascript
    const package = require("[package-name]");
    ```
    Then implement your custom methods and logic to handle the hardware. Don't forget to export the methods at the end of the file:
    ```javascript
    module.exports = { ... };
    ```

3. **Expose sensors via MQTT**: If you want to publish sensor data through MQTT, implement some init and update methods in the `integration.js` file:
    ```javascript
    const initCustomSensor = (client) => { ... }
    const updateCustomSensor = (client) => { ... }
    ```
    To get started have a look at the existing methods. Don't forget to call the custom sensor initialization method inside the global init method, where the MQTT connection is established:
    ```javascript
    const init = async (args) => { ... }
    ```
    From there, you will need to further refine your code by tinkering with sensor updates. This can be achieved through either periodic update calls or event based triggers.

</div></details>

### The nitty gritty

<details><summary>Don't waste your time reading this.</summary><div></br>

The Raspberry Pi's **build-in on-screen keyboard** named `squeekboard` (it squeaks because some _Rust_ got inside), is specifically designed for Wayland environments and features a **D-Bus interface** that allows applications to show or hide the keyboard as needed.
The kiosk application interacts with squeekboard via the `D-Bus` object path `/sm/puri/OSK0`, enabling the keyboard to be hidden or shown based on **MQTT** user input or system events.

The Raspberry Pi's **build-in screen blanking** function uses the command `swayidle -w timeout 600 'wlopm --off \*' resume 'wlopm --on \*' &` inside `~/.config/labwc/autostart` to blank the screen after **10 minutes**.
The `wlopm --off \*` command changes the `/sys/class/backlight/*/bl_power` value to **4**, when setting the value to **0** the screen will turn on again.
However, `swayidle` still seems to consider the screen to be off and as a result it will not turn off again unless there is some interaction in the meantime.

When using the MQTT integration, the kiosk application must be able to **detect changes** made on the **device** itself.
I managed to achieve this for the `/sys/class/backlight/*/brightness` file by implementing a simple `fs.watch(..)` file listener.
However, I found that it **never triggered** for the `/sys/class/backlight/*/bl_power` or the `/sys/class/drm/*/dpms` file.
Although the file content changes, none of the filesystem listeners where fired.
This could be due to `swayidle`/`wlopm` performing write actions at a deeper level that are not detectable by file listeners.

As a result, I went for a **polling solution**, checking the state of the `/sys/class/backlight/*/brightness` and `/sys/class/drm/*/dpms` file **every second** for any changes.
In case `ddcutil` is installed the file `~/.config/touchkio/Cache/Brightness.vcp` will be written/monitored to support brightness support for HDMI screens.
While I understand this is not ideal, it's necessary to ensure proper functionality.

The display power status and brightness can be adjusted via the MQTT integration.
**Support** for changing the power status on **DSI and HDMI** displays is achieved by checking for connected screens in `/sys/class/drm/*/status`.
Support for changing the brightness of a connected display is implemented by using `sudo tee /sys/class/backlight/*/brightness` or `sudo ddcutil setvcp 10`.
In cases where no supported backlight device is found, the Home Assistant light entity will only show an on/off switch without brightness control.

Keep in mind that default arguments are stored as plain text in `~/.config/touchkio/Arguments.json`.
This file also includes the **MQTT user password**, which is somewhat obfuscated/encrypted, but in a way that it could be easily reverse engineered.
Implementing stronger **security measures** would complicate the setup process and could discourage some users from configuring the application properly.
When using the kiosk application without initializing the default arguments, you will need to provide them with every command.
This means that the password may be stored as plain text in various files, such as `touchkio.service`, `~/.bash_history`, etc.

To address the problem where the first **touch** on a **turned-off screen** may trigger a **click event** (which could inadvertently activate Home Assistant actions), a workaround needed to be implemented.
When the screen **turns on/off**, the timestamps of these events are recorded.
If a touch event is detected and the **timestamp** of the **last screen-off** is more recent than the **last screen-on** timestamp, the touch event is discarded and the screen is turned on instead.
From that point onward, subsequent touch interactions will function normally as expected.

Additionally, to address the problem that scrolling only works with the **web browser scrollbar** on the right, the application is configured to **simulate a touch device** using `Emulation.setEmitTouchEventsForMouse`.
This adjustment provides a user experience similar to that of a proper mobile device.

</div></details>

## Issues
### Please read the hardware [FAQ](https://github.com/leukipp/touchkio/blob/main/HARDWARE.md#faq) section first if you encounter any issues.

For basic debugging **(TouchKio)**, stop the service and launch `touchkio` directly on the terminal to monitor the log output in real-time.
This output is also written into `~/.config/touchkio/logs/main.log` for review.

For extended logging **(Electron)** you can run `touchkio --enable-logging`, which will write an additional log file into `~/.config/touchkio/logs/electron.log`.
Refer to the [--log-level=[0-3]](https://www.electronjs.org/docs/latest/api/command-line-switches#--log-leveln) and [--v=[0-3]](https://www.electronjs.org/docs/latest/api/command-line-switches#--vlog_level) options to adjust the logging verbosity.

If you need to debug the webview **(Chrome DevTools)** use `touchkio --app-debug`.

In case [undocumented problems](https://github.com/leukipp/touchkio/blob/main/HARDWARE.md#faq) arise, please [create an issue](https://github.com/leukipp/touchkio/issues) and include the output of `touchkio --version`, additional information about your system (such as operating system, hardware, etc.), and any relevant log files.

## Credits
[Inspired by](https://www.jeffgeerling.com/blog/2024/home-assistant-and-carplay-pi-touch-display-2) the one and only Raspberry Pi Master, Jeff Geerling ([@geerlingguy](https://github.com/geerlingguy)).

Thanks to Sebastian ([@pdsccode](https://github.com/pdsccode)) for his contributions on issues and [community](https://community.home-assistant.io/t/kiosk-mode-for-raspberry-pi-with-touch-display/821196) discussions.

### Tutorials
If you are looking for hardware or a well-designed mounting solution for the Raspberry Pi Display, check out the [blog post](https://www.thestockpot.net/videos/home-assistant-wall-display) from Dillan Stock ([@TheStockPot-AU](https://www.youtube.com/@TheStockPot-AU)):

<a href="https://www.youtube.com/watch?v=uTxURzmrVtA">
  <img src="https://img.youtube.com/vi/uTxURzmrVtA/maxresdefault.jpg" alt="What My Smart Home Was Missing" title="@TheStockPot-AU" style="width:100%">
</a>

Also, have a look at this curated collection of helpful videos contributed by the community:

<p align="center" style="width:100%">
  <a href="https://www.youtube.com/watch?v=_adl1fiXlgk">
    <img src="https://img.youtube.com/vi/_adl1fiXlgk/mqdefault.jpg" alt="Building a Home Assistant Kiosk - Why Did I Wait So Long?" title="@Jims-Garage" style="width:32%">
  </a>
  <a href="https://www.youtube.com/watch?v=uXcjx-zL_UU">
    <img src="https://img.youtube.com/vi/uXcjx-zL_UU/mqdefault.jpg" alt="Touch Display for Home Assistant with TouchKIO" title="@haus_automation" style="width:32%">
  </a>
  <a href="https://www.youtube.com/watch?v=t2YQm7GPmpY">
    <img src="https://img.youtube.com/vi/t2YQm7GPmpY/mqdefault.jpg" alt="DIY Home Assistant Kiosk Build: Raspberry Pi & 3D Printing Livestream" title="@homeautomatorza" style="width:32%">
  </a>
</p>

## License
[MIT](https://github.com/leukipp/touchkio/blob/main/LICENSE)
