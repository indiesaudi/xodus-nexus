# Xodus Nexus 0.4.1

- Add a redesigned Social panel with player profiles, friend management and separate chat windows.
- Add a notification bell for unread messages and game updates, including a 9+ badge. Open conversations at the latest message and keep read state in sync between windows.
- Add experimental Xbox voice parties and the optional **Nexus Overlay**, with a configurable shortcut, screen edge and shared party controls.
- Improve download and update performance with parallel transfers, batched writes and pipelined reuse of verified local data. Recover interrupted updates safely and prevent launching incomplete updates.
- Add native ARM64 launcher and backend builds, architecture-aware runtime downloads and per-game FEX settings.
- Add Microsoft offline-device permissions and license-checked offline launches with a compatible runtime. Games need an online launch after designating the device.
- Open screenshots, achievements and game details for games that are not installed. Keep installation tied to the selected edition.
- Fix overlay shortcut editing, disabled-overlay shortcut registration and opening the overlay when game-window display information is unavailable. Show enabled status in green.
- Fix Xbox sign-in for compact JWE tickets and malformed or reordered authentication responses.
- Avoid unnecessary administrator password prompts on devices without an SMBIOS firmware table.
- Add community French and Polish UI translations and update translation synchronization and review tools.

Thanks @Rbanh, @indiesaudi, @burghr and @xerhab for their contributions.

## Xodus Nexus backend 0.2.13

- Add native ARM64 builds and authenticated Social, chat and voice-party APIs.
- Improve downloads and incremental updates while preserving verified data, recovery checkpoints and active game sessions.
- Support Microsoft-designated offline play with account-bound licenses and revocation checks.
- Fix Xbox authentication response handling and skip missing SMBIOS firmware tables at sign-in.

## Nexus runtime

- Fix Age of Empires IV startup with current-game Windows Store licensing. Thanks @Anirudh09.
- Add experimental native ARM64 runtime builds and keep per-game FEX state separate from the installed runtime.
- Support license-gated offline sign-in with the compatible backend and launcher.

ARM64 game compatibility remains experimental. In-game invitation support varies by game; Deep Rock Galactic invitation delivery is not fixed in this update.
