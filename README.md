# TouchKio
**TouchKio** is a Node.js application that utilizes **Electron** to create a kiosk mode specifically designed for a Home Assistant dashboard.
This tool is packaged as a **.deb** file, making it easy to launch the kiosk mode on a **Raspberry Pi** equipped with the official 7" touch display.

[![display](https://raw.githubusercontent.com/leukipp/touchkio/main/img/display.png)](https://github.com/leukipp/touchkio/blob/main/img/display.png)

This implementation addresses common issues encountered when using the built-in browser running in fullscreen mode on the Raspberry Pi touch display.
Moreover, the device running the **kiosk application** also offers several **Home Assistant MQTT** sensors, enhancing it's functionality for automation purposes.

## Features
- [x] Fast and easy setup.
- [x] Touch friendly web browser interface.
- [x] Configurable zoom and theme support. 
- [x] Single-tap screen wake-up functionality.
- [x] Remote controllable via MQTT.
  - [x] Manage kiosk window status.
  - [x] Touch display power and brightness.
  - [x] Execute system reboot and shutdown commands.
  - [x] Monitor temperature, processor and memory usage.

The kiosk application can be executed with command line arguments to load a **Home Assistant dashboard in fullscreen** mode.
Additionally, a **MQTT endpoint** can be defined, allowing the application to provide controls and sensors for the Raspberry Pi and the connected touch display.

## Setup
Before you begin, make sure that you have a Raspberry Pi configured and operational with a compatible touch display.
This guide assumes that you are using the latest version of **Raspberry Pi OS (64-bit)** together with a desktop environment.

### Optional
To utilize the sensor features of your display through Home Assistant, it's essential to have a **MQTT broker running** and the **MQTT integration installed** on your Home Assistant instance.
This setup allows seamless communication between your kiosk device and Home Assistant, enabling **real-time data exchange**.

[![mqtt](https://raw.githubusercontent.com/leukipp/touchkio/main/img/mqtt.png)](https://github.com/leukipp/touchkio/blob/main/img/mqtt.png)

For a comprehensive guide on setting up MQTT with Home Assistant, please refer to the official documentation available here: https://www.home-assistant.io/integrations/mqtt.

## Installation
On the first run of the application, you may encounter a **setup procedure** and the Home Assistant **login screen**.
It's recommended to create a **dedicated user** (local access only) for your kiosk device.
You might also need a keyboard or remote VNC access to input these credentials once.

#### Option 1 - The easy way
Run this command to download and install the release **.deb** file. It will also adjust some permissions, create a systemd file for auto-startup and will guide you through the setup process:
```bash
bash <(wget -qO- https://raw.githubusercontent.com/leukipp/touchkio/main/install.sh)
```
If you are paranoid, or smart, or both, have a look into the [install.sh](https://github.com/leukipp/touchkio/blob/main/install.sh) script before executing external code on your machine.

#### Option 2 - The hard way
The [install.sh](https://github.com/leukipp/touchkio/blob/main/install.sh) script mentioned above performs the following tasks (and you just have to do it manually):
- [Download](https://github.com/leukipp/touchkio/releases/latest) the latest **.deb** file,
which is specifically suitable for Raspberry Pi **(64-bit)** ARM architecture.
- Open a terminal and execute the following command to install the application, e.g:
`sudo dpkg -i touchkio_1.x.x_arm64.deb`
- If you just want to load a Home Assistant dashboard without further control you are good to go, e.g: `touchkio --web-url=https://demo.home-assistant.io`

If you need the application to be automatically started on boot, create a **systemd file**.  
If you need the Home Assistant MQTT sensors, create the **udev rule** for backlight control.

## Configuration
Running `touchkio --setup` will prompt you to enter arguments that will be used when the application starts without any specified arguments.
These default arguments are stored in `~/.config/touchkio/Arguments.json`, where they can also be modified.

### WEB
The available arguments to control the kiosk application via terminal are as follows: 
| Name                     | Default | Description                                            |
| ------------------------ | ------- | ------------------------------------------------------ |
| `--web-url` (Required)   | -       | Url of the Home Assistant instance (HTTP(S)://IP:PORT) |
| `--web-theme` (Optional) | `dark`  | Theme settings of the web browser (`light` or `dark`)  |
| `--web-zoom` (Optional)  | `1.25`  | Zoom settings of the web browser (`1.0` is `100%`)     |

These arguments allow you to customize the appearance of the web browser window.

For example:
```bash
touchkio --web-url=http://192.168.1.42:8123 --web-theme=dark --web-zoom=1.25
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
You can find them under **Settings** -> **Devices and Services** -> **Devices** by searching for "Raspberry Pi".

For example:
```bash
touchkio --web-url=http://192.168.1.42:8123 --mqtt-url=mqtt://192.168.1.42:1883 --mqtt-user=kiosk --mqtt-password=password
```

### DISPLAY
To enable display control, you can use the following argument. Please be advised, that HDMI displays do not allow for control and setting the type to DSI, while using an HDMI display will break functionality
| Name                          | Default         | Description                                                                              |
| ----------------------------- | --------------- | ---------------------------------------------------------------------------------------- |
| `--display-type` (Required)   | HDMI            | Sets the display type to enable/disable display control (Allwed: HDMI, DSI)              |

## Development
If you want to create your own local build install [nodejs](https://pimylifeup.com/raspberry-pi-nodejs) and [yarn](https://classic.yarnpkg.com/lang/en/docs/install) on your Raspberry Pi.

Clone this repository and run `yarn install` to install the dependencies.
Then use `yarn start` to execute the `start` script located in the `package.json` file.
There you can adjust the `--web-url`, `--display-type` and other arguments for development runs.

### The nitty gritty

<details><summary>Don't waste your time reading this.</summary><div></br>

To enable **write access** to the `/sys/class/backlight/10-0045/bl_power` and `/sys/class/backlight/10-0045/brightness` files, you need to set up a **udev rule**.
This is done within the `install.sh` script, which also creates a `.service` file.
While creating a service file is optional, it's highly recommended if you want your Raspberry Pi to automatically boot into kiosk mode.

To differentiate between HDMI and DSI (e.g. official Raspberry Pi Touch Display), --display-type is used as a manual override for now. This might change in the future by implementing autodiscovery of the display type.

The Raspberry Pi's **build-in screen blanking** function uses the command `swayidle -w timeout 600 'wlopm --off \*' resume 'wlopm --on \*' &` inside `~/.config/labwc/autostart` to blank the screen after **10 minutes**.
The `wlopm --off \*` command changes the `bl_power` value to **4**, when setting the value to **0** the screen will turn on again.
However, `swayidle` still seems to consider the screen to be off and as a result it will not turn off again unless there is some interaction in the meantime.

When using the MQTT integration, the kiosk application must be able to **detect changes** made on the **device** itself.
I managed to achieve this for the `brightness` file by implementing a simple `fs.watch(..)` file listener.
However, I found that it **never triggered** for the `bl_power` file.
Although the file content changes, none of the filesystem listeners where fired.
This could be due to `swayidle`/`wlopm` performing write actions at a deeper level that are not detectable by file listeners.
As a result, I went for a **polling solution**, checking the state of both files every **500 milliseconds** for any changes.
While I understand this is not ideal, it's necessary to ensure proper functionality.

Keep in mind that default arguments are stored as plain text in `~/.config/touchkio/Arguments.json`.
This file also includes the **MQTT user password**, which is somewhat obfuscated/encrypted, but in a way that it could be easily reverse engineered.
Implementing stronger **security measures** would complicate the setup process and could discourage some users from configuring the application properly.
When using the kiosk application without initializing the default arguments, you will need to provide them with every command.
This means that the password may be stored as plain text in various files, such as `touchkio.service`, `~/.bash_history`, etc.

To resolve the issue where the first **touch** on a **turned-off screen** triggers a **click event** (potentially activating Home Assistant actions), I implemented a workaround.
When the screen **turns off**, I remove **focus** from the kiosk window.
This way, the first click only turns the screen on and focuses the window, allowing subsequent clicks to work as expected.

Additionally, to address the problem that scrolling on the Raspberry Pi only works with the **web browser scrollbar** on the right, I configured the Electron app to **simulate a touch device** using `Emulation.setEmitTouchEventsForMouse`.
This adjustment provides a user experience similar to that of a proper mobile device.

Electron apps are known to be **resource intensive** due to their architecture and the inclusion of a full web browser environment. If you just run the kiosk application without other heavy loads, everything should run smoothly.

</div></details>

## Issues
- You can use Raspberry Pi's build-in screen blanking functionality, however, if the screen is turned on through Home Assistant after being automatically turned off, it will remain on indefinitely.
  - It's recommended to either use the built-in screen blanking feature or implement a Home Assistant automation (e.g., presence detection) to manage the screen status.
- Hyperlinks that redirect the browser away from the main window are intentionally disabled.
  - This decision was made to maintain a clean design, as navigation buttons to move back and forth between different sites were not included.
- On the Raspberry Pi terminal you may see some *ERROR:gbm_wrapper.cc* messages.
  -  This appears to be a [known issue](https://github.com/electron/electron/issues/42322) that currently lacks a fix, but the webview still works.

## Credits
Inspired by the one and only Raspberry Pi Master Lord, [Jeff Geerling](https://www.jeffgeerling.com/blog/2024/home-assistant-and-carplay-pi-touch-display-2).

## License
[MIT](https://github.com/leukipp/touchkio/blob/main/LICENSE)
