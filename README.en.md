# best-lights-selector

English | [日本語](README.md)

A daemon that runs on your PC and shows up in the Home app as a single virtual **Matter light**. When Home turns it on or off, it switches your real lights through the SwitchBot API depending on the current time (e.g. ceiling light by day, spot lights at night).

- **ON** from Home: turns on the light of the `[schedules.*]` entry that contains the current time, and turns off any other light that is on.
- **OFF** from Home: turns off every light.
- If the virtual light stays on while the time window changes (e.g. at 06:00 / 18:00), the new window's light is turned on and the others are turned off (checked every 15 seconds).
- If a SwitchBot call fails, the switch state in Home is rolled back.
- At startup, the state Home last saw (stored with the pairing data) is compared with the real lights, and the real lights are aligned to it if they differ (nothing happens before the first pairing).

## Install

Download the executable for your platform and `config.example.toml` from the [latest release](https://github.com/NaeCqde/best-lights-selector/releases/latest).

| File | Platform |
|---|---|
| `best-lights-selector-Windows-x86_64.exe` | Windows (x64) (tested) |
| `best-lights-selector-macOS-aarch64` | macOS (Apple Silicon) |
| `best-lights-selector-Linux-x86_64-musl` | Linux (x64) |
| `best-lights-selector-Linux-aarch64-musl` | Linux (arm64) |
| `config.example.toml` | Config template |

> Developed and tested on Windows. The macOS / Linux builds come from the same code but are untested.

Each executable has a `.sha256` next to it. They are standalone; nothing else needs to be installed. On macOS / Linux, run `chmod +x` first.

## Setup

All settings live in `config.toml`, read from the current working directory. Copy `config.example.toml` and edit it.

> `config.toml` contains your SwitchBot credentials and the pairing data (`.matter-storage`) is sensitive too. Both are in `.gitignore`; never commit them.

1. Set the SwitchBot `token` / `secret` in `[switchbot]` (see the comments in the file for how to get them).
2. Find the deviceId of each light and set it as `device_id` in `[lights.<name>]`. It can be one string or an array (`["id1", "id2"]`); all listed devices are switched together (the SwitchBot API has no groups, so one request is sent per device). From source, `bun run list-devices` lists them (the executable does not include this command).
3. Define time windows in `[schedules.N]` (`start` inclusive, `end` exclusive; if `start` > `end` the window wraps past midnight).

## Run

Start the executable from the folder that contains `config.toml`.

```bash
./best-lights-selector-macOS-aarch64
```

If it is not paired yet, a QR code and a manual pairing code are printed to the console. In the Home app choose "Add Accessory" and scan the QR code, or use "More options" and enter the code (accept the uncertified-accessory warning with "Add Anyway").

Pairing data is stored in `storage_path` (default `.matter-storage`). Delete that folder to pair again.

> A VPN / virtual adapter (e.g. Tailscale) can prevent Home from connecting. In that case set `[matter] network_interface` in `config.toml` to the number of your LAN adapter (e.g. `15`). If the name is not found at startup, the usable adapters are printed. `bun run list-interfaces` lists them.
>
> The Home hub (HomePod / Apple TV) and this PC must be on the same network (one where mDNS works). On Windows, allow inbound UDP 5353 (mDNS) and `matter.port` (default UDP 5540) in the firewall.

## About the matter.js patch

`patches/@matter%2Fnodejs@0.17.9.patch` is a Windows fix for matter.js (`@matter/nodejs`), applied automatically by `bun install`. On Windows the interface of a received packet is a numeric zone id (e.g. `15`), but matter.js looked it up by interface name. As a result every mDNS query (the HomePod asking "where is this device?") was ignored, and the device only worked from Home right after pairing before showing "No Response". When bumping `@matter/*`, check whether upstream has fixed this.

## Run / build from source

Requires [Bun](https://bun.com).

```bash
bun install
cp config.example.toml config.toml
bun run start            # run
bun run list-devices     # list SwitchBot devices
bun run list-interfaces  # list network adapters
bun run build            # build a standalone executable named best-lights-selector
```

Set `BUN_TARGET` (e.g. `bun-linux-x64-musl`) and `BUN_OUTFILE` to cross-compile.

## License

MIT
