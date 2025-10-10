# Supported Hardware
This document contains an incomplete list of device and display hardware combinations that have already been tested.

The [release](https://github.com/leukipp/touchkio/releases) page has builds exclusively for **arm64** and **x64**, but custom builds for other architectures can be made (see [development](https://github.com/leukipp/touchkio?tab=readme-ov-file#development)), allowing the application to operate on any hardware.
At least the **minimal** features, such as displaying a **kiosk window** (which doesn't necessarily need to be Home Assistant) will work.

## Hardware
If you are running Linux with a graphical user interface (Wayland or X11), you should be well equipped to use the application. Additionally, any single board computer (SBC) clones of the Raspberry Pi that operate on Raspberry Pi OS **(64-bit)** are likely to function as well.

|     | Status                | Notes                                                                     |
| --- | --------------------- | ------------------------------------------------------------------------- |
| 🟩   | Fully operational     | Working display power, brightness and keyboard control via MQTT.          |
| 🟨   | Partially operational | Display brightness control is not available via MQTT.                     |
| 🟧   | Partially operational | Display brightness and keyboard control is not available via MQTT.        |
| 🟥   | Partially operational | Display power, brightness and keyboard control is not available via MQTT. |
| ⬜   | Somehow operational   | Issues can occur and the overall performance is very slow.                |
| ⬛   | Not operational       | The house is on fire.                                                     |

### DSI
| Device                 | System                                 | Display                                                                                                   | Status |
| ---------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------ |
| Raspberry Pi 3 (arm64) | Raspberry Pi OS (64-bit), Wayland, X11 | [Official 7" Touch Display 1 (800x480)](https://www.raspberrypi.com/products/raspberry-pi-touch-display/) | ⬜      |
| Raspberry Pi 3 (arm64) | Raspberry Pi OS (64-bit), Wayland, X11 | [Official 7" Touch Display 2 (720x1280)](https://www.raspberrypi.com/products/touch-display-2/)           | ⬜      |
| Raspberry Pi 4 (arm64) | Raspberry Pi OS (64-bit), Wayland, X11 | [Official 7" Touch Display 1 (800x480)](https://www.raspberrypi.com/products/raspberry-pi-touch-display/) | 🟩      |
| Raspberry Pi 4 (arm64) | Raspberry Pi OS (64-bit), Wayland, X11 | [Official 7" Touch Display 2 (720x1280)](https://www.raspberrypi.com/products/touch-display-2/)           | 🟩      |
| Raspberry Pi 5 (arm64) | Raspberry Pi OS (64-bit), Wayland, X11 | [Official 7" Touch Display 1 (800x480)](https://www.raspberrypi.com/products/raspberry-pi-touch-display/) | 🟩      |
| Raspberry Pi 5 (arm64) | Raspberry Pi OS (64-bit), Wayland, X11 | [Official 7" Touch Display 2 (720x1280)](https://www.raspberrypi.com/products/touch-display-2/)           | 🟩      |

### HDMI
| Device                    | System                                 | Display                                                                                                               | Status |
| ------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------ |
| Raspberry Pi 4 (arm64)    | Raspberry Pi OS (64-bit), Wayland, X11 | [LAFVIN Touch Display 5" (800x480)](https://www.amazon.de/gp/product/B0BWJ8YP7S)                                      | 🟨      |
| Raspberry Pi 4 (arm64)    | Raspberry Pi OS (64-bit), Wayland, X11 | [Waveshare 7EP-CAPLCD 7" (1280x800)](https://www.waveshare.com/7ep-caplcd.htm)                                        | 🟨      |
| Raspberry Pi 4 (arm64)    | Raspberry Pi OS (64-bit), Wayland, X11 | [Waveshare CAPLCD 8" (768x1024)](https://www.waveshare.com/wiki/8inch_768x1024_LCD)                                   | 🟨      |
| Raspberry Pi 4 (arm64)    | Raspberry Pi OS (64-bit), Wayland, X11 | [Hannspree HT225 21.5" (1920x1080)](https://www.hannspree.eu/product/HT-225-HPB)                                      | 🟨      |
| Raspberry Pi CM 4 (arm64) | Raspberry Pi OS (64-bit), Wayland, X11 | [Lenovo ThinkCentre 23.8" (1920x1080)](https://psref.lenovo.com/Detail/ThinkCentre_Tiny_In_One_24_Gen_5?M=12NBGAT1EU) | 🟨      |
| Raspberry Pi 400 (arm64)  | Raspberry Pi OS (64-bit), Wayland, X11 | [UPerfect Vertical Touch 15.6" (1920x1080)](https://uperfect.com/products/uperfect-y-vertical-monitor-15-6)           | 🟨      |
| Raspberry Pi 5 (arm64)    | Raspberry Pi OS (64-bit), Wayland, X11 | [GeeekPi Capacitive Touch 10.1" (1280x800)](https://www.amazon.nl/dp/B0DHV6DZC1)                                      | 🟨      |
| Raspberry Pi 5 (arm64)    | Raspberry Pi OS (64-bit), Wayland, X11 | [ELECROW Portable Monitor 10.1" (1280x800)](https://www.amazon.co.uk/dp/B0BHHQLKPY)                                   | 🟨      |
| Raspberry Pi 5 (arm64)    | Raspberry Pi OS (64-bit), Wayland, X11 | [Waveshare Capacitive Touch 14" (2160x1440)](https://www.waveshare.com/14inch-2160x1440-lcd.htm)                      | 🟨      |
| Raspberry Pi 5 (arm64)    | Raspberry Pi OS (64-bit), Wayland, X11 | [Akntzcs Portable Touch HD 16" (1920x1200)](https://www.amazon.com/dp/B0CTGW6MQ6)                                     | 🟨      |
| Raspberry Pi 5 (arm64)    | Raspberry Pi OS (64-bit), Wayland, X11 | [Prechen Portable Touch FHD 18.5" (1920x1080)](https://www.amazon.de/dp/B0CT2KLDBQ)                                   | 🟨      |
| Raspberry Pi 5 (arm64)    | Raspberry Pi OS (64-bit), Wayland, X11 | Generic Non-Touch                                                                                                     | 🟨      |
| Generic PC (x64)          | Debian KDE (64-bit), Wayland, X11      | Generic Non-Touch                                                                                                     | 🟧      |
| Generic PC (x64)          | Ubuntu XFCE (64-bit), X11              | Generic Non-Touch                                                                                                     | 🟧      |
| Generic PC (x64)          | Ubuntu GNOME (64-bit), X11             | Generic Non-Touch                                                                                                     | 🟧      |
| Generic PC (x64)          | Ubuntu GNOME (64-bit), Wayland         | Generic Non-Touch                                                                                                     | 🟥      |

## Features
**Minimal features** are designed to run on any system without issues:

- A webview kiosk window launched in fullscreen mode and loading the specified `--web-url` website should not cause any problems.
- When connecting to an internal HTTPS site with a self-signed certificate, ensure the specified FQDN matches. Using the `--ignore-certificate-errors` flag is [not recommended](https://github.com/leukipp/touchkio/issues/76) for browsing external sites.

**Extended features** become available when the `--mqtt-*` arguments are provided and the hardware is supported:

- The following commands are currently implemented to modify the display status. Make sure that one of these works for your display when you run it directly on the terminal, otherwise the MQTT switch will not work either.
  - `wlopm --[on,off] \*` (Raspberry Pi OS, Wayland)
  - `kscreen-doctor --dpms [on,off]` (Debian KDE, Wayland)
  - `xset dpms force [on,off]` (Generic, X11)
- If your hardware is not fully compatible there should be no crashes, but you may miss some sensors.
  - On some Debian based systems (e.g. Ubuntu GNOME), the display status control is only available when using X11 (`xset`).
- There are certain HDMI screens (e.g. Viewsonic) where the display status command doesn't work as expected.
  - The screen [immediately turns on again](https://github.com/leukipp/touchkio/issues/38), which may be caused by incompatible HDMI cables being used.
- On Raspberry Pi OS the display command may fail with `ERROR: Setting power mode for output '[DSI-*,HDMI-*]' failed`.
  - This can happen if you have `wayvnc` running for remote access and is caused by a [known bug](https://github.com/leukipp/touchkio/issues/78).
- Certain commands from the MQTT integration may require elevated privileges to work correctly.
  - Ensure that your local user has the [necessary permissions](https://github.com/leukipp/touchkio/issues/39) to run `sudo` without being prompted for a password.

Hardware support is verified during application startup and can be seen in the terminal or in the log file under the `Supported` section.
The necessary requirements for MQTT sensors to work are listed here:
| Name                 | Requirements                                                            | References                                                                                                 |
| -------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| App (Update)         | Requires `sudo` rights, `.deb` install and `touchkio.service` running . | [#70](https://github.com/leukipp/touchkio/issues/70), [#77](https://github.com/leukipp/touchkio/issues/77) |
| Display (Status)     | Working `wlopm`, `kscreen-doctor` or `xset` command.                    | [#38](https://github.com/leukipp/touchkio/issues/38), [#57](https://github.com/leukipp/touchkio/issues/57) |
| Display (Brightness) | Device under `/sys/class/backlight/*/brightness` exists.                | [#30](https://github.com/leukipp/touchkio/issues/30), [#32](https://github.com/leukipp/touchkio/issues/32) |
| Keyboard             | Raspberry Pi OS (Wayland) with `squeekboard` running.                   | [#7](https://github.com/leukipp/touchkio/issues/7), [#85](https://github.com/leukipp/touchkio/issues/85)   |
| Battery              | Device under `/sys/class/power_supply/*/capacity` exists.               | [#33](https://github.com/leukipp/touchkio/issues/33)                                                       |
| Volume               | Device (non-dummy) `pactl get-default-sink` exists.                     | [#82](https://github.com/leukipp/touchkio/issues/82)                                                       |
| Reboot               | Requires password-less `sudo` rights.                                   | [#39](https://github.com/leukipp/touchkio/issues/39)                                                       |
| Shutdown             | Requires password-less `sudo` rights.                                   | [#39](https://github.com/leukipp/touchkio/issues/39)                                                       |


## Contributions
In case your hardware is not listed above don't worry, give it a try.
Running `touchkio --web-url=https://demo.home-assistant.io` will most likely just work.
The only problems that may arise are when controlling the display via the Home Assistant integration.

- If you encounter any problems, please create a new [issue](https://github.com/leukipp/touchkio/issues).
- If you encounter any problems and are able to fix it yourself, feel free to create a [pull request](https://github.com/leukipp/touchkio/pulls).
- If everything works as expected and your hardware is not yet listed, you are welcome to [report](https://github.com/leukipp/touchkio/issues/12) it or create a [pull request](https://github.com/leukipp/touchkio/pulls).
