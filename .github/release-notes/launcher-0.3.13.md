# Xodus Nexus 0.3.13 for AYN Odin 3

A build of Xodus Nexus for the AYN Odin 3 and other arm64 Linux handhelds, with offline play. It installs and updates its backend and runtime from [indiesaudi/xodus-nexus](https://github.com/indiesaudi/xodus-nexus). These changes are proposed upstream but not merged yet.

## What's new

- **Offline licenses renew themselves:** after an online game session Nexus renews the 30-day offline license of every game you have played offline before, at most once a day, not only the game you just launched. Offline play no longer lapses for games you have not opened online in a while. Needs backend **0.2.15**.
- **Background service (opt-in):** **Settings → Advanced → Background service** runs games from a small systemd user service. Steam's **Exit game** then closes the game the way you would, so the runtime finishes its cloud-save upload before it quits, and Steam comes back right away while the game closes. A crash of the service never takes a running game with it; it picks the game up again when it restarts.
- The launcher shows a closing game as **Closing** and labels the force stop.

## Install

```sh
curl -fsSL https://raw.githubusercontent.com/indiesaudi/xodus-nexus/main/scripts/install.sh | bash
```

Existing installs offer the update in the launcher. Then, in **Settings**, update the Nexus backend to **0.2.15**. The Nexus runtime stays at **11.0-20261025-g33cf5423**. Odin 3 setup and offline-play steps are in the [README](https://github.com/indiesaudi/xodus-nexus#install-on-the-ayn-odin-3).

> [!CAUTION]
> This is an unofficial fork of Xodus Nexus, which is itself an independent, unofficial project built on Xodus.
