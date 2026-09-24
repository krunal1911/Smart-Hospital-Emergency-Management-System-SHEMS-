# Smart Hospital Emergency Management System (SHEMS)

SHEMS is a real-time emergency healthcare coordination network that connects patients, responders, and hospitals in a single secure environment.

## Running Locally

1. **Backend Server**:
   ```bash
   cd backend
   npm install
   npm run dev
   ```
   *Requires a local MongoDB server running on `mongodb://127.0.0.1:27017` (the default already configured in `backend/.env`). Install [MongoDB Community Server](https://www.mongodb.com/try/download/community) and start it (`mongod`, or via your OS service manager) before running `npm run dev`. On first startup against an empty database, the server automatically seeds the demo accounts listed below — no manual seed step needed.*

   Wait for these exact lines before starting the frontend:
   ```
   MongoDB Connected Successfully
   Smart Hospital EMS running on port 5000
   ```

2. **Frontend App**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   *The frontend is accessible at `http://localhost:5173/`.*

## Emergency Help / SOS (no login required)

Go to `http://localhost:5173/emergency` (or click the red "Emergency Help / SOS" button on the home page). Allow location access when prompted, then:
1. Get Emergency Help Now → creates a temporary Emergency Case ID.
2. Pick a nearby ambulance → Request This Ambulance.
3. Pick a nearby hospital (shows live emergency/ICU/trauma bed counts) → Select & Notify This Hospital.
4. You'll see a live-updating status screen. No account, password, or personal info was ever required.

### Search by PIN Code

Instead of (or alongside) the map, you can type a 6-digit Indian PIN code and click Search. This:
1. Geocodes the PIN code to real coordinates (via OpenStreetMap's Nominatim — no API key needed).
2. Runs a geospatial search around that point, merging your own registered hospitals with **real hospitals from OpenStreetMap**, sorted by distance, with a "Open in Google Maps" link on each.
3. Automatically expands the search radius (5 → 10 → 20 → 50 km) until it finds something — it only reports "no results" after trying all four.

Run `npm run test:pincodes` (from `backend/`, with your server's MongoDB connection available and internet access) to verify this against 10 real Indian PIN codes across different cities and get a pass/fail report.

If you have existing hospitals/ambulances in your database from before this feature was added, run `npm run migrate:geo` once (from `backend/`) to backfill the geospatial index data they need to show up in searches.

## Demo Accounts (Auto-seeded)

Use these accounts to test the different role dashboards:

| Role | Email | Password |
| :--- | :--- | :--- |
| **System Admin** | `admin@shems.com` | `adminpassword123` |
| **Patient (John Doe, Bandra West)** | `patient@shems.com` | `patientpassword123` |
| **Patient (Alice Smith, Andheri East)** | `alice@shems.com` | `patientpassword123` |
| **Hospital (City Emergency Hospital, Santacruz West)** | `hospital1@shems.com` | `hospitalpassword123` |
| **Hospital (Metro General Clinic, Kurla West)** | `hospital2@shems.com` | `hospitalpassword123` |
| **Hospital (St. Mary Trauma Center, Bandra West)** | `hospital3@shems.com` | `hospitalpassword123` |
| **Hospital (New Life Clinic — pending admin approval)** | `hospital4@shems.com` | `hospitalpassword123` |
| **Driver (Ambulance MH-02-AB-1234, City Emergency Hospital)** | `driver1@shems.com` | `driverpassword123` |
| **Driver (Ambulance MH-03-CD-5678, Metro General Clinic)** | `driver2@shems.com` | `driverpassword123` |
| **Driver (Ambulance MH-01-EF-9012, St. Mary Trauma Center)** | `driver3@shems.com` | `driverpassword123` |

## Core Simulation Features

1. **Intake Decisioning**:
   - Log in as **Patient** and request an emergency ambulance from *City Emergency Hospital*.
   - Log in as **Hospital** (`hospital1@shems.com`) to Accept the pending request. An ambulance is automatically dispatched.
2. **GPS Routing Simulator**:
   - Log in as **Driver** (`driver1@shems.com`). Accept the assignment.
   - Click "Simulate GPS Movement". The driver's location will step closer to the patient, updating ETAs in real-time.
   - Progress the journey stages until completion.
3. **Admitting & Bed Count Deductions**:
   - On completion of the run, the system automatically checks symptoms and deducts 1 bed of the corresponding category (ICU/Oxygen/General) from the hospital's available inventory.

## Troubleshooting

### The Emergency Help page opens, but nothing else on it works
This almost always means the **frontend can't reach the backend** — the SOS page itself needs no backend call to open (it's just a client-side route), but every button on it does. Check, in order:
1. Open the backend terminal. Does it end with `[SERVER] Smart Hospital EMS is running on port 5000`? If it's stuck earlier, see the next section.
2. Open your browser's DevTools (F12) → **Console** tab. Click the failing button, then look for a line starting with `[EmergencyHelp]`. It will name the exact call that failed and, in most cases, an HTTP status code.
3. Open DevTools → **Network** tab, click the button again, and find the request to `/api/public/emergency/...`. Check its status: `(failed)`/red usually means the backend isn't running or isn't on port 5000; a 4xx/5xx means the backend responded with an error — open it and read the `message` field in the response body.
4. Confirm the frontend is actually running through Vite (`npm run dev` in `frontend`, not just opening an HTML file directly) — the `/api` proxy to `http://localhost:5000` only works when Vite's dev server is serving the page.

If you're stuck, send me the exact `[EmergencyHelp] ...` console line and the Network tab's status code/response body for the failing request and I'll pinpoint it immediately.

### Backend never finishes starting / exits immediately with a database connection error
The backend now always connects to a real MongoDB instance via `MONGODB_URI` in `backend/.env` (default: `mongodb://127.0.0.1:27017/smart-hospital-ems`). If it exits with `[DATABASE] Database connection error`, MongoDB isn't running or isn't reachable at that address.

Fix: install [MongoDB Community Server](https://www.mongodb.com/try/download/community) locally and start it (`mongod`, or via your OS service manager / `brew services start mongodb-community` / `sudo systemctl start mongod`), or point `MONGODB_URI` at a free MongoDB Atlas cluster instead. Once MongoDB is reachable, `npm run dev` will connect, auto-build indexes, auto-seed demo accounts on first run, and start listening.

### "Network Error" / CORS error in the browser console
The backend already allows all origins (`cors({ origin: '*' })`), so this is almost always the backend simply not being reachable at `localhost:5000` — re-check the backend terminal is running and didn't crash (scroll up for a `[DATABASE] Database connection error` line).
