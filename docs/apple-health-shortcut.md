# Apple Health → Baymax with an iPhone Shortcut

`Sync with Baymax` reads the last seven days of Steps, Exercise Minutes, Water, and Sleep. It posts selected samples to Baymax, which validates them and saves daily summaries for this browser's care space. The daily-metrics agent tool then uses these readings instead of generated demo values.

The first version runs when the user runs the Shortcut. Running workouts, heart rate, and other Health categories are not included. It does not write to Apple Health. Native HealthKit access and guaranteed background syncing are outside this integration.

## Run locally on a Mac and iPhone

1. Put the Mac and iPhone on the same Wi-Fi. Guest networks that isolate devices will not work.
2. Configure the existing database values in `.env`. Use a development database/branch for the new migration. `DATABASE_URL_UNPOOLED` is preferred by the migration runner; the app continues using `DATABASE_URL`.
3. Apply the additive migration:

   ```sh
   npm run db:migrate
   ```

4. Print the Mac's network address and the commands to use:

   ```sh
   npm run shortcut:local
   ```

5. Start Mastra with the printed `APP_ORIGIN` (for example `http://192.168.1.20:5173`) and start Vite in another terminal. If these servers are already running, restart the backend with this origin. Vite already listens on all interfaces and proxies `/health` to Mastra.
6. Open the printed **network URL on the Mac**, rather than localhost. This makes the browser cookie and write origin match the local demo. Enable **Remember across visits** and wait for the saved status.
7. Open **Privacy & preferences → Connect Apple Health**. Download the Shortcut to the iPhone, by opening the same local site there or transferring the generic file. You can generate the key on the Mac and paste it into the phone; the key associates the phone with that Mac browser's workspace.
8. In the Shortcut's import questions (or first three Text actions), enter the exact **sync address**, **connection key**, and **time zone** shown by Baymax. The address ends in `/health/apple/import`. `localhost` on the iPhone points to the iPhone, not the Mac.
9. Run **Sync with Baymax** on the iPhone. Allow the categories you want to share and allow access to the Mac's address. The result displays `importedDays` on success or an error message. Denied categories can remain unavailable; if iOS stops execution at a denied Health action, allow that read or remove that category block from the Shortcut.
10. Refresh the readings in Baymax, then ask, “Review my last week using my Apple Health readings.”

The development HTTP URL is for this local demo. For a hosted installation, use the deployed HTTPS origin in `APP_ORIGIN` and the matching HTTPS sync address. If the Mac's Wi-Fi address changes, update both the backend origin and the Shortcut address.

## Files

- [`../public/shortcuts/Sync-with-Baymax.shortcut`](../public/shortcuts/Sync-with-Baymax.shortcut): signed, installable generic template; contains no connection keys or personal readings.
- [`../shortcuts/Sync-with-Baymax.plist`](../shortcuts/Sync-with-Baymax.plist): readable workflow source for reviewing all 72 actions.
- [`../scripts/build-apple-health-shortcut.py`](../scripts/build-apple-health-shortcut.py): deterministic standard-library generator. `python3 scripts/build-apple-health-shortcut.py` rebuilds only the source; `npm run shortcut:build` also signs it on a Mac.
- [`../migrations/003_apple_health.sql`](../migrations/003_apple_health.sql): connection/token-hash storage and daily summaries, with deletion cascading from the saved care space.

Signing submits only the generic template to Apple's validation service using `shortcuts sign --mode anyone`. Never embed a live key in the public template or commit a personalized Shortcut.

## Data contract

`POST /health/apple/import` accepts `Authorization: Bearer <connection key>` and `Content-Type: application/json`. No browser cookie or `Origin` header is required for this Shortcut request. The key grants import access only; it cannot read the care space or health data.

The JSON shape is:

```json
{
  "version": 1,
  "timeZone": "America/Los_Angeles",
  "exportedAt": "2026-10-04T12:00:00-07:00",
  "samples": [
    {
      "type": "steps",
      "startDate": "2026-10-04T08:00:00-07:00",
      "endDate": "2026-10-04T08:10:00-07:00",
      "source": "Apple Watch",
      "value": "1200",
      "unit": "count"
    }
  ]
}
```

The example is illustrative: live requests need a current `exportedAt`. Allowed sample types are `steps`, `activeMinutes`, `hydrationMl`, and `sleep`. Values can be numbers or plain numeric strings; sleep also accepts recognized category names. Dates must include an ISO 8601 offset or `Z`. The export must be less than 24 hours old, samples must be within the past 31 days, and the body is limited to 2 MB / 20,000 samples.

Units are explicit: count/steps; minutes, seconds, or hours for exercise; mL/L or explicitly US/imperial fluid ounces for water. Ambiguous or unsupported units reject the import rather than guessing. If a device exports an unsupported unit spelling, convert that measurement to minutes or mL in the Shortcut before sending it.

Sleep category values `1`, `3`, `4`, `5` and Asleep/Core/Deep/REM labels count as sleep. Awake, In Bed, and unrecognized categories are excluded. Overlapping sleep intervals from one source are merged and assigned to the local date they end. Each metric selects the source with the most recorded activity that day; sources are never summed together. This is a conservative duplicate-avoidance rule, **not Apple's exact multi-device merge algorithm**, so totals can differ from the Health app.

Repeated imports replace daily totals, never increment them. Partial updates preserve previously shared categories. Older snapshots cannot overwrite newer days. Missing readings are `null`, not zero, and are excluded from averages and below-target counts. Raw samples are discarded after normalization; only daily summaries and export/sync timestamps are persisted.

## Connection lifecycle and agent behavior

- `GET /health/apple/connection`: browser-cookie-scoped connection status, last sync, and the last seven calendar days of summaries.
- `POST /health/apple/connection`: requires the browser's valid write origin and a saved workspace with memory consent. Creates or rotates an unpredictable key; only its SHA-256 hash is stored. The plaintext key is returned once and kept only in the current setup component.
- `DELETE /health/apple/connection`: revokes the key and removes imported health summaries. Turning off memory or deleting the care space also cascades to both tables.
- Mastra middleware derives the health owner from the HttpOnly browser cookie and overwrites client-supplied request context. Agent tools cannot choose another workspace by passing an owner ID.
- When the connection lookup succeeds, connected users never get synthetic daily metrics substituted for missing readings. The existing health cards display “Not shared.” Synthetic running, check-in, and medical-profile tools also stop returning their demo facts for a connected user; check-ins can be taken from the user's existing care context.
- If the database is unavailable or the Apple Health migration has not been applied, agent health tools fall back to explicitly labeled synthetic demo data. Connection and import requests still report that Health sync is unavailable; a failed lookup does not claim that imported readings were retrieved.
- The manual habit dashboard remains the user's care workspace. The Apple Health panel and daily-metrics chat cards show imported readings separately; manual water/check-in actions do not write back to Apple Health.

## Verification and first device check

Offline tests use PGlite and synthetic samples: unit/time-zone normalization, sleep overlap, per-source deduplication, missing readings, persistence, browser isolation, consent, key rotation/revocation, stale imports, request limits, and cascading deletion. Run `npm test`, `npm run build`, and `npm run agent:build`.

The workflow is structurally checked and signed by Apple's service. **Health reads still need a first run on a real iPhone**; macOS cannot execute those Health actions. Confirm the four type pickers and seven-day date filters after installation, run the Shortcut, compare the latest dates/units with Health, then check Baymax's sync status and chat. Apple signing verifies the file; it does not prove the Health permissions or data conversion work on a particular phone.

## Reference evidence

- Apple: [Find and Filter actions](https://support.apple.com/en-ca/guide/shortcuts/apd3c845e881/ios), [API requests and request bodies](https://support.apple.com/en-lb/guide/shortcuts/apd58d46713f/ios), [command-line signing](https://support.apple.com/my-mm/guide/shortcuts-mac/apd455c82f02/mac).
- Workflow serialization checked against Apple-bundled `.wflow` examples and ActionKit intent metadata, and [captured iOS Health action exports](https://github.com/viticci/shortcuts-playground-plugin/blob/main/codex/skills/shortcuts-playground/HEALTHKIT.md). The generator is purpose-built for Baymax, with no runtime dependency on that repository.
