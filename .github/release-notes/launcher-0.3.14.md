# Xodus Nexus 0.3.14 for x86_64 and arm64 Linux

A build of Xodus Nexus for x86_64 and arm64 Linux devices, with offline play. It runs natively on both architectures and installs and updates its backend and runtime from [indiesaudi/xodus-nexus](https://github.com/indiesaudi/xodus-nexus). These changes are proposed upstream but not merged yet.

## Highlights

- **x86_64 and arm64:** launcher, Nexus backend and Nexus runtime are native builds for both; the launcher picks the matching backend and runtime for your CPU. The arm64 build is tested on my AYN Odin 3 running ArmadaOS.
- **Offline play:** on the device your Microsoft account designates for offline play, games start without a connection using their stored 30-day license, renewed after online sessions.
- **Background service (opt-in):** **Settings → Advanced → Background service** lets Steam's **Exit game** close games cleanly, so cloud saves finish uploading.

No code changes since 0.3.13; this release updates the description to cover every x86_64 and arm64 Linux device.

## Install

```sh
curl -fsSL https://raw.githubusercontent.com/indiesaudi/xodus-nexus/main/scripts/install.sh | bash
```

Existing installs offer the update in the launcher. The Nexus backend stays at **0.2.15** and the Nexus runtime at **11.0-20261025-g33cf5423**. Setup and offline-play steps are in the [README](https://github.com/indiesaudi/xodus-nexus#install).

> [!CAUTION]
> This is an unofficial fork of Xodus Nexus, which is itself an independent, unofficial project built on Xodus.
