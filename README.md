# DHA Render Starter

This is a starter web app that converts a paper Daily Hazard Analysis workflow into a phone-friendly form plus QR-code crew signing flow.

## What it does
- Foreman creates a DHA at `/foreman/new`
- App stores the record in `data/db.json`
- Each DHA gets a unique crew sign link and QR code
- Crew signs from phone at `/sign/:token`
- Dashboard shows all DHA records at `/dashboard`

## Local run
```bash
npm install
npm start
```
Then open:
- http://localhost:3000/dashboard
- http://localhost:3000/foreman/new

## Render deploy
1. Create a new Git repo and upload these files.
2. In Render, create a new Web Service from the repo.
3. Render can use the included `render.yaml`, or you can set manually:
   - Build Command: `npm install`
   - Start Command: `npm start`
4. Add environment variable:
   - `BASE_URL` = your deployed app URL (example: `https://your-app.onrender.com`)

## Important MVP note
This starter stores data in a JSON file for simplicity. That is okay for demo/testing, but for real field use on Render you should move storage to PostgreSQL so data persists reliably across deploys and restarts.

## Suggested next upgrades
- Replace JSON storage with Render Postgres
- Add user login for foremen/admins
- Add PDF export matching your current DHA sheet
- Add editable task rows with add/remove buttons
- Add supervisor final signoff
- Add weather autofill and project templates
