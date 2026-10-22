# PwaniGrid: code package

Offline-ready smart energy-metering tokens: Express + MongoDB backend, React admin
dashboard (phase 1), and ESP32-S3 keypad meter firmware.

    PwaniGrid/
      backend/            Express API (Node.js)
      frontend/           React + Vite admin dashboard (login, overview, meters)
      firmware/sketch/    ESP32-S3 sketch.ino
      .gitignore          keeps .env, keys/ and node_modules out of Git

## Important

* This package contains NO secrets: no `.env`, no `keys/`. Create them as below.
* USSD, M-Pesa payments and SMS are SIMULATIONS. No real money moves and no real SMS is sent.
* The dashboard pages Tokens, Transactions, Reports and USSD are placeholders ("built in the next step").
* The firmware has not been compiled on a real board. Report any compile error.
* Plain HTTP on a local network is for bench testing only.

## 1. Backend (PowerShell, from the PwaniGrid folder)

    cd backend
    npm install
    Copy-Item .env.example .env
    notepad .env          # fill in MONGODB_URI and the secrets (see below)
    npm run keys          # creates keys/private.pem and keys/public.pem
    npm run admin         # creates your admin login
    npm run dev           # http://localhost:5000

Generate the random values for `.env` (run each, paste the result):

    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # JWT_SECRET and TOKEN_ENC_KEY (64 hex)
    node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"   # USSD_CALLBACK_SECRET (48 hex)

Never paste your real `.env` into chat or GitHub. If MongoDB says "bad auth", the
database user's password in MONGODB_URI is wrong (Atlas > Database Access > Edit Password).

## 2. Frontend

    cd frontend
    npm install
    npm run dev           # http://localhost:5173  (the dev server proxies /api to port 5000)

Run backend and frontend in two separate terminals.

## 3. Firmware (Arduino IDE)

1. Install "esp32 by Espressif Systems". Board: ESP32S3 Dev Module, USB CDC On Boot: Enabled,
   PSRAM: OPI PSRAM, Serial Monitor 115200.
2. Libraries: Keypad (Mark Stanley), ArduinoJson 7.x.
3. Open `firmware/sketch/sketch.ino`, edit section 1 (Wi-Fi, laptop LAN IP, METER_ID from the
   dashboard), upload.
4. Never connect the relay to mains. Use the low-voltage load only.

## Test order

Login -> register a meter (dashboard shows the server-generated ID) -> generate a token with
POST /api/tokens (response includes a 12-digit `code`) -> type the code on the keypad.
