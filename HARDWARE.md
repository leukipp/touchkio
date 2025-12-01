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

**Extended features** become available when the `--mqtt-*` arguments are provided and the hardware is supported:
- If your hardware is not fully compatible there should be no crashes, but you may miss some sensors.

Hardware support is verified during application startup and can be checked in the terminal or in the log file under the `Supported` section.
The necessary requirements for MQTT sensors to work are listed here:
| Name                 | Requirements                                                                                                  | References                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| App (Update)         | Requires `sudo` rights, `.deb` install and `touchkio.service` running .                                       | [#70](https://github.com/leukipp/touchkio/issues/70), [#77](https://github.com/leukipp/touchkio/issues/77)   |
| Display (Status)     | Working `wlopm`, `kscreen-doctor` or `xset` command.                                                          | [#38](https://github.com/leukipp/touchkio/issues/38), [#57](https://github.com/leukipp/touchkio/issues/57)   |
| Display (Brightness) | Requires `sudo` rights, device under `/sys/class/backlight/*/brightness` exists or working `ddcutil` command. | [#30](https://github.com/leukipp/touchkio/issues/30), [#101](https://github.com/leukipp/touchkio/issues/101) |
| Keyboard             | Raspberry Pi OS (Wayland) with `squeekboard` running.                                                         | [#7](https://github.com/leukipp/touchkio/issues/7), [#85](https://github.com/leukipp/touchkio/issues/85)     |
| Battery              | Device under `/sys/class/power_supply/*/capacity` exists.                                                     | [#33](https://github.com/leukipp/touchkio/issues/33)                                                         |
| Volume               | Device (non-dummy) `pactl get-default-sink` exists.                                                           | [#82](https://github.com/leukipp/touchkio/issues/82)                                                         |
| Reboot               | Requires password-less `sudo` rights.                                                                         | [#39](https://github.com/leukipp/touchkio/issues/39)                                                         |
| Shutdown             | Requires password-less `sudo` rights.                                                                         | [#39](https://github.com/leukipp/touchkio/issues/39)                                                         |

## FAQ

### Operating System

<details><summary>I have installed Ubuntu GNOME.</summary>

  - On some Debian based systems (e.g. Ubuntu GNOME), the display status control is only available when using X11 (`xset`).
  - GNOME is the least supported window manager.
    - It's recommended to switch to KDE wayland, if you want better support for display status control (`kscreen-doctor`).

</details>

<details><summary>I have installed Raspberry Pi OS on a RPI3.</summary>

  - Raspberry Pi 3 devices have produced a bunch of issues in the past.
    - [RPI 3B wayland rendering issue](ttps://github.com/leukipp/touchkio/issues/104).
    - [RPI 3b+ thermostat card issue](https://github.com/leukipp/touchkio/issues/17).
    - [Webpage cards don't work (Pi3b+)](https://github.com/leukipp/touchkio/issues/24).
 - It looks like the GPU is not properly supported by Electron.
    - Running `touchkio --disable-gpu` may improve the situation, but upgrading the hardware is the best solution.

</details>

<details><summary>I want to update APT packages automatically.</summary>

  - The **Package Upgrades** MQTT sensor will show if `apt` package upgrades are available, but updates are [intentionally](https://github.com/leukipp/touchkio/issues/7) not triggered by TouchKio.
  - It's recommended to keep your system up to date for security and compatibility, as TouchKio primarily supports the latest OS versions. 
    - Consider configuring `sudo apt install unattended-upgrades` for automatic updates.

</details>

### Display

<details><summary>Display status can't be controlled through MQTT.</summary>

  - The following commands are currently implemented to modify the display status. Make sure that one of these works for your display when you run it directly on the terminal, otherwise the MQTT switch will not work either.
    - `wlopm --[on,off] \*` (Raspberry Pi OS, Wayland)
    - `kscreen-doctor --dpms [on,off]` (Debian KDE, Wayland)
    - `xset dpms force [on,off]` (Generic, X11)

</details>

<details><summary>Display brightness can't be controlled through MQTT.</summary>

  - Have a look at the [features](https://github.com/leukipp/touchkio/blob/main/HARDWARE.md#features) section to check if all requirements are fulfilled.
    - The **Display** MQTT control is a light entity with brightness support. So make sure to to [click on the entity](https://github.com/leukipp/touchkio/issues/75) to check for brightness support.
  - HDMI screens typically do not offer brightness control out of the box, so additional setup steps are required.
    - Brightness support for [ddcutil](https://github.com/leukipp/touchkio/issues/101#issuecomment-3521247263) is build-in and checked on application startup.
    - Alternatively installing [ddcci-driver-linux](https://github.com/leukipp/touchkio/issues/132#issue-3659009749) or [ddcci-dkms](https://github.com/leukipp/touchkio/issues/101#issuecomment-3571523927) may also work.

</details>

<details><summary>Turning HDMI screen off via MQTT causes it to turn back on.</summary>

  - There are certain HDMI screens (e.g. Viewsonic) where the MQTT display status command doesn't work as expected. 
    - The screen [immediately turns on again](https://github.com/leukipp/touchkio/issues/38), which may be caused by incompatible HDMI cables being used.

</details>

### Touch

<details><summary>Automated screen blanking on inactivity.</summary>

  - You can use Raspberry Pi's build-in [screen blanking](https://www.raspberrypi.com/documentation/computers/configuration.html#screen-blanking-3) functionality, however, if the screen is turned on through Home Assistant after being automatically turned off, it will remain on indefinitely.
    - It's recommended to either use the built-in screen blanking feature or implement a Home Assistant [automation](https://www.home-assistant.io/docs/automation/basics) (e.g. presence detection or **Last Active** MQTT sensor) to manage the screen status.

</details>

<details><summary>Touch in multitouch mode not waking the screen.</summary>

  - It's recommended to use **Mouse Emulation** for touch screens, otherwise touch based [screen wake-up](https://github.com/leukipp/touchkio/issues/127) from display off state will fail, especially if build-in [screen blanking](https://www.raspberrypi.com/documentation/computers/configuration.html#screen-blanking-3) is disabled.

</details>

<details><summary>Touch events may propagate through a display that is turned off.</summary>

  - It's recommended to use **Mouse Emulation** for touch screens, otherwise Home Assistant actions could be triggered [unintentionally](https://github.com/leukipp/touchkio/issues/61) on touch.

</details>

### Network

<details><summary>Connecting via https/mqtts with a self-signed certificate.</summary>

  - When connecting to a service with a [custom certificate](https://github.com/leukipp/touchkio/issues/42#issuecomment-3041870215), ensure the specified FQDN matches.
    - Using the `--ignore-certificate-errors` flag is [not recommended](https://github.com/leukipp/touchkio/issues/76) for browsing external sites.

</details>

<details><summary>Local DNS entries in /etc/hosts are ignored.</summary>

  - Electron bypasses the system resolver stack, ignoring `/etc/hosts` and local DNS servers.
    - To use the system resolver, modify `~/.config/systemd/user/touchkio.service` to disable these features:
    ```bash
    ExecStart=/usr/bin/touchkio --disable-features=UseDNSHttps,AsyncDns
    ```

</details>

<details><summary>During VNC access the display turns gray.</summary>

  - On Raspberry Pi OS the display command may fail with `ERROR: Setting power mode for output '[DSI-*,HDMI-*]' failed`.
    - This can happen if you have `wayvnc` running for remote access and is caused by a [known bug](https://github.com/leukipp/touchkio/issues/78).

</details>

### Media

<details><summary>I need Music and Voice Assistant.</summary>

  - Not planned, look for [alternatives](https://github.com/leukipp/touchkio/issues/88#issuecomment-3366659265).

</details>

<details><summary>I need a camera stream from the device.</summary>

  - Not planned, look for [alternatives](https://github.com/leukipp/touchkio/issues/130#issuecomment-3591770594).

</details>

<details><summary>I need additional MQTT entities to control hardware.</summary>

  - Not planned, look for [alternatives](https://github.com/leukipp/touchkio/issues/138#issuecomment-3591784725).

</details>

### Dependencies

<details><summary>Some of the MQTT controls are missing.</summary>

  - Certain [features](https://github.com/leukipp/touchkio/blob/main/HARDWARE.md#features) from the MQTT integration may require elevated privileges to work correctly.
    - Test if your local user has the [necessary permissions](https://github.com/leukipp/touchkio/issues/39) to run `sudo -n true` without being [prompted for a password](https://github.com/leukipp/touchkio/issues/116#issuecomment-3471566411).

</details>

<details><summary>The ddcutil command doesn't seem to be used.</summary>

  - Currently `ddcutil` is only used for brightness control of HDMI screens.
    - Make sure that your screen is supporting [continuous](https://github.com/leukipp/touchkio/issues/101#issuecomment-3521247263) adjustments of brightness values.

</details>

<details><summary>The on-screen keyboard doesn't automatically pop-out.</summary>

  - Most of the available on-screen keyboards will not render above any [fullscreen window](https://forums.raspberrypi.com/viewtopic.php?p=2327148).
  - There is a [workaround](https://github.com/leukipp/touchkio/issues/85) for `squeekboard`, which will only work on Raspberry Pi OS.
    - If the on-screen keyboard still doesn't [automatically pop-out](https://github.com/leukipp/touchkio/issues/4) when entering a text field inside the webview you can use the side [widget](https://github.com/leukipp/touchkio/issues/16) to toggle the visibility.

</details>

### Errors

<details><summary>Terminal is full with "ERROR:gbm_wrapper.cc" messages.</summary>

  - On the terminal you may see some _ERROR:gbm_wrapper.cc_ messages.
    - This appears to be a [known issue](https://github.com/electron/electron/issues/42322) that currently lacks a fix, but the webview still works.

</details>

<details><summary>CPU and RAM usage increases without reason.</summary>

  - This was [especially observed](https://github.com/leukipp/touchkio/issues/123) when the screen is permanently on and renders a dashboard with interactive elements (e.g. custom lovelace cards).  
    - Switching to another **Page Url** or turning the **Display** off during idle times improves resource usage.  
    - Alternatively a timed **Refresh** of the webview via MQTT can also help.

</details>

<details><summary>Error message "GPU Process abnormal-exit".</summary>

  - _GPU Process abnormal-exit (code 512)_ means that the Electron GPU process crashed, probably caused by some issues inside the webview.
    - Disabling the GPU via `touchkio --disable-gpu` may help.
 
</details>

<details><summary>Error message "Render Process killed".</summary>

  - _Render Process killed (code 9)_ will lead to a temporary [white screen](https://github.com/leukipp/touchkio/issues/115).
  - The problem likely stems from Electron’s calculated RAM limit (~2GB) and the dashboard using too much memory.
    - Although there are flags to [increase the limit](https://github.com/leukipp/touchkio/issues/36#issuecomment-3406441947), a standard webview shouldn’t require that much RAM.

</details>

## Contributions
In case your hardware is not listed above don't worry, give it a try.
Running `touchkio --web-url=https://demo.home-assistant.io` will most likely just work.
The only problems that may arise are when controlling the display via the Home Assistant integration.

There is a possibility to test `pre-releases` if you would like to try upcoming versions before the official release is published.
These early builds are available to a smaller group of users who have chosen to take part in testing.

If you are interested in long-term testing, check out the related [help request](https://github.com/leukipp/touchkio/issues/96).
When a [pre-release](https://github.com/leukipp/touchkio/releases) is available and you want to test it on-demand, run:
```bash
bash <(wget -qO- https://raw.githubusercontent.com/leukipp/touchkio/main/install.sh) update early
```

- If you encounter any problems, please create a new [issue](https://github.com/leukipp/touchkio/issues).
- If you encounter any problems and are able to fix it yourself, feel free to create a [pull request](https://github.com/leukipp/touchkio/pulls).
- If everything works as expected and your hardware is not yet listed, you are welcome to [report](https://github.com/leukipp/touchkio/issues/12) it or create a [pull request](https://github.com/leukipp/touchkio/pulls).
