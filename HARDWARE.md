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
| Raspberry Pi 4 (arm64)    | Raspberry Pi OS (64-bit), Wayland, X11 | [LAFVIN 5" Touch Display (800x480)](https://www.amazon.de/gp/product/B0BWJ8YP7S)                                      | 🟨      |
| Raspberry Pi 4 (arm64)    | Raspberry Pi OS (64-bit), Wayland, X11 | [Waveshare 8" CAPLCD (768x1024)](https://www.waveshare.com/wiki/8inch_768x1024_LCD)                                   | 🟨      |
| Raspberry Pi 4 (arm64)    | Raspberry Pi OS (64-bit), Wayland, X11 | [Waveshare 7" 7EP-CAPLCD (1280x800)](https://www.waveshare.com/7ep-caplcd.htm)                                        | 🟨      |
| Raspberry Pi 4 (arm64)    | Raspberry Pi OS (64-bit), Wayland, X11 | [Hannspree HT225 21.5" (1920x1080)](https://www.hannspree.eu/product/HT-225-HPB)                                      | 🟨      |
| Raspberry Pi 400 (arm64)  | Raspberry Pi OS (64-bit), Wayland, X11 | [UPerfect Vertical Touch 15.6" (1920x1080)](https://uperfect.com/products/uperfect-y-vertical-monitor-15-6)           | 🟨      |
| Raspberry Pi CM 4 (arm64) | Raspberry Pi OS (64-bit), Wayland, X11 | [Lenovo ThinkCentre 23.8" (1920x1080)](https://psref.lenovo.com/Detail/ThinkCentre_Tiny_In_One_24_Gen_5?M=12NBGAT1EU) | 🟨      |
| Raspberry Pi 5 (arm64)    | Raspberry Pi OS (64-bit), Wayland, X11 | [GeeekPi 10.1" Capacitive Touch (1280x800)](https://www.amazon.nl/dp/B0DHV6DZC1)                                      | 🟨      |
| Raspberry Pi 5 (arm64)    | Raspberry Pi OS (64-bit), Wayland, X11 | [Prechen Portable Touch 18.5" FHD (1920x1080)](https://www.amazon.de/dp/B0CT2KLDBQ)                                   | 🟨      |
| Raspberry Pi 5 (arm64)    | Raspberry Pi OS (64-bit), Wayland, X11 | [Akntzcs Portable Touch 16" HD (1920x1200)](https://www.amazon.com/dp/B0CTGW6MQ6)                                     | 🟨      |
| Raspberry Pi 5 (arm64)    | Raspberry Pi OS (64-bit), Wayland, X11 | [ELECROW Portable Monitor 10.1" (1280x800)](https://www.amazon.co.uk/dp/B0BHHQLKPY)                                   | 🟨      |
| Raspberry Pi 5 (arm64)    | Raspberry Pi OS (64-bit), Wayland, X11 | Generic Non-Touch                                                                                                     | 🟨      |
| Generic PC (x64)          | Debian KDE (64-bit), Wayland, X11      | Generic Non-Touch                                                                                                     | 🟧      |
| Generic PC (x64)          | Ubuntu GNOME (64-bit), X11             | Generic Non-Touch                                                                                                     | 🟧      |
| Generic PC (x64)          | Ubuntu GNOME (64-bit), Wayland         | Generic Non-Touch                                                                                                     | 🟥      |

## Contributions
In case your hardware is not listed above don't worry, give it a try.
Running `touchkio --web-url=https://demo.home-assistant.io` will most likely just work.
The only problems that may arise are when controlling the display or keyboard via the Home Assistant integration.

- If you encounter any problems, please create a new [issue](https://github.com/leukipp/touchkio/issues).
- If you encounter any problems and are able to fix it yourself, feel free to create a [pull request](https://github.com/leukipp/touchkio/pulls).
- If everything works as expected and your hardware is not yet listed, you are welcome to [report](https://github.com/leukipp/touchkio/issues/12) it or create a [pull request](https://github.com/leukipp/touchkio/pulls).
