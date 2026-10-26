# Xodus Nexus backend 0.2.17 (fork)

Upstream backend 0.2.12 (Xbox friends and messaging, DLC, conditional licenses, Store device-limit guidance, installation size estimates) plus this fork's changes:

- Keep offline licenses only under Microsoft's offline lease, store the lease as issued and validate it again at every offline start: lease type, offline policy, its own expiry and expiration date, device binding against the key license, account and device registration, at most 30 days after issue, and no clock set back behind the last use. `run --license-cache`, `run --offline`.
- Revoke stored licenses when Microsoft reports this device as not designated (`offline-pc --license-cache`, or a key license that is not device-bound), on account or device changes, and on licensing refusals. Recognize device registrations whose license carries no `DeviceId`, and lease dates without a timezone offset.
- Tell the runtime whether it may use or keep its offline sign-in (`XODUS_OFFLINE_IDENTITY`).
- Start offline launches in seconds: bounded connection attempts, and no PlayFab authorisation on the stored offline license.
- Run games under any Proton from a private full launch view (`run --materialize-all --view-dir`), with the PlayFab Game Saves adapter staged for the exact supported SDK (`run --playfab-adapter`). Every launch view is created 0700.
- Native aarch64 build; no administrator prompt at sign-in on devices without an SMBIOS table.
