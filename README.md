# Veridock: customs clearance, proven.

Multi-tenant clearance and transit tracker for freight forwarders at the Port of Douala and Kribi Deep Seaport.
Transit agencies log each customs milestone with mandatory document proof; importers follow a live link sent by SMS.

## Structure
- `backend/` Express + MongoDB (Mongoose). Tenant-isolated API, proof enforcement, demurrage risk engine, SMS service, hourly risk job.
- `desk/` Transit Desk (React + Vite, desktop). Agency operators register containers and log milestones.
- `tracker/` Importer Tracker (React + Vite, mobile first). Public vertical timeline with viewable proof.
- `branding/` Logo and icon (SVG).

## Run locally
1. Backend: `cd backend && cp .env.example .env` (fill MONGODB_URI, JWT_SECRET), then `npm i && npm run seed && npm run dev`
2. Desk: `cd desk && npm i && npm run dev` (http://localhost:5173), sign in with `manager@demo.cm` / `Demo#2026`
3. Tracker: `cd tracker && npm i && npm run dev` (http://localhost:5174/bl/<token>); copy the token from "Copy tracking link" in the Desk.

## Key rules implemented
- **Anti-falsification:** `POST /api/consignments/:id/advance` moves only to the next milestone and rejects the request without a JPG/PNG/WEBP/PDF proof (max 8 MB). Each proof stores a SHA-256 fingerprint, uploader and time.
- **Audited corrections:** manager-only `POST /:id/revert` with a written reason.
- **Demurrage engine:** `daysRemaining = freeDays - (today - arrival)`, clock stops at gate pass. Under 3 days = `CRITICAL_RISK`, below 0 = `FINES_ACCUMULATING`, 3 to 5 days = `WARNING`. Recomputed live on every read and refreshed hourly by cron.
- **Isolation:** `tenantId` is taken from the signed token, never from the request. B/L is unique per tenant (`tenantId + billOfLading`).
- **Public links:** random unguessable token (`/bl/<token>`); the public API hides phone numbers and agency internals.
- **SMS:** Cameroon number normalisation (+237), 3 retries, every attempt logged. Runs in mock mode until `SMS_API_URL` is set; adapt the payload in `backend/src/services/sms.js` for Campay, Orange or MTN.

## Added in v1.1
- **CAMCIS reference** on every container (set at registration or later). Agents may record it once; only managers can change it. It also shows on the importer tracker so the importer can cross-check with Customs.
- **Performance tab** in the Desk (`GET /api/consignments/analytics`): average clearance time, average days per milestone with the slowest step highlighted, results by shipping line, demurrage days incurred, and staff activity.

## Added in v1.2: demurrage tariff (port transit phase)
- Container type (20' Dry, 40' Dry, 40' High Cube) on every container; free time defaults to 11 calendar days.
- Each agency has an editable tariff (Desk, Demurrage tariff tab, manager only). Defaults: 20' Dry 6,000 to 7,500 XAF/day, 40' Dry/HC 12,000 to 15,000 XAF/day after free time, doubling after day 21.
- Charges are estimated up to the Gate Pass milestone and shown as a range in the container list, the container panel, the Performance tab and the importer tracker. Detention (outside the terminal) is not tracked.
- Logic lives in `backend/src/services/demurrage.js`.

## Deploy
- Render web service for `backend` (set env vars, use Cloudinary because Render disk is ephemeral), static sites for `desk` and `tracker` with `VITE_API_URL` pointing at the API. For the tracker, add an SPA rewrite of `/*` to `/index.html`.
- Onboard agencies with `POST /api/auth/super-login` then `POST /api/auth/admin/tenants`.
