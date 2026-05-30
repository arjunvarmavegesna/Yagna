# YagnaMed v3 — Go-Live Runbook

This is the step-by-step to put the app online safely for the pharmacy. Work top to bottom.
Steps marked **[you]** are manual account actions only you can do (I can't access your Firebase/Vercel/Anthropic accounts).

---

## What changed vs. the original file

The app is now built to run as a hosted site, not a local file:

- **The Anthropic key never reaches the browser.** Both AI calls now go to `/api/anthropic` (a serverless proxy) using a shared **Pharmacy Access Code** instead of pasting the real key. The proxy holds the key and the current model IDs server-side.
- **Audit database is locked down** with `database.rules.json` + Firebase Anonymous Auth (no more world-readable DB; session codes can't be enumerated).
- **Day-one fixes:** current model IDs (the old ones were retired and would 404), PharmAudit entries now survive a refresh (saved to IndexedDB), and photos are compressed before upload so they don't blow past serverless size/time limits.

File layout:
```
index.html            # the app (served at /)
api/anthropic.js      # serverless proxy — key + models pinned server-side, access-code gated
vercel.json           # function timeout
database.rules.json   # Firebase Realtime DB security rules
.env.example          # which env vars to set in Vercel
```

---

## 1. Anthropic — get a key and set a spend cap **[you]**

1. At <https://console.anthropic.com>, create/copy an API key (`sk-ant-...`). Keep it secret.
2. **Set a monthly spend limit** (Billing → Limits). This is your real backstop — if the access code ever leaks, the cap stops runaway cost. Pick a number comfortably above expected monthly use.

## 2. Firebase — create project, enable auth, deploy rules **[you]**

1. <https://console.firebase.google.com> → **Add project**.
2. **Build → Realtime Database → Create Database** (pick a region, start in *locked mode*).
3. **Build → Authentication → Get started → Sign-in method → enable Anonymous.**
4. **Project settings (gear) → General → Your apps → Web app (`</>`)** → register → copy the `firebaseConfig` object.
5. Paste those values into `AT_FB_CONFIG` near the top of the audit section in `index.html` (replace every `REPLACE_WITH_...`). This config is **not** a secret — security comes from the rules + auth.
6. Deploy the security rules: in the Realtime Database → **Rules** tab, paste the contents of `database.rules.json` and **Publish**.
   - *(Optional, recommended in week one)* enable **App Check** (reCAPTCHA) on the Realtime Database for stronger protection of the inventory data.

## 3. Put the code on GitHub **[you]**

From this folder:
```
git init
git add .
git commit -m "YagnaMed v3 — production launch"
```
Create a new GitHub repo and push (`git remote add origin ...` / `git push -u origin main`).
The `.gitignore` already keeps secrets (`.env`, `.vercel`) out of the repo.

## 4. Deploy to Vercel **[you]**

1. <https://vercel.com> → **Add New → Project** → import the GitHub repo.
2. Framework preset: **Other** (it's static + a function — no build step). Click Deploy.
3. **Settings → Environment Variables** — add (values from `.env.example`):
   - `ANTHROPIC_API_KEY` = your `sk-ant-...`
   - `ACCESS_CODE` = a non-obvious passcode for staff
4. **Redeploy** so the env vars take effect (Deployments → ⋯ → Redeploy).
5. You now have an HTTPS URL (e.g. `https://yagnamed.vercel.app`). HTTPS is required for the camera — done automatically.

> If the deploy errors on `maxDuration: 60`, your plan caps function duration lower — lower the number in `vercel.json` (e.g. `26`) and redeploy.

## 5. Hand the access code to staff

Staff open the URL, and the first time they use an AI feature they enter the **Pharmacy Access Code** (the `ACCESS_CODE` you set). It's stored per browser tab, so they re-enter it if they fully close the tab — that's expected, not a bug. To rotate it, change `ACCESS_CODE` in Vercel and redeploy.

---

## Pre-launch test checklist (do on a real phone, over the HTTPS URL)

- [ ] **Login gate:** opening the site shows the access-code login screen. A wrong code is rejected ("Incorrect access code"); the correct code lets you in and you stay logged in on refresh. The header **🔓 Logout** button returns you to the login screen.
- [ ] **AI works:** PharmAudit → snap a medicine photo → "Read photos" fills the form. Drug Enrichment returns filled rows (not "⚠ Failed").
- [ ] **Key is hidden:** open the browser's DevTools → Network during an AI call → confirm you only see `/api/anthropic` with `x-access-code`, and **no** `sk-ant-` key anywhere.
- [ ] **Access gate:** enter a wrong code → AI calls show "Invalid access code".
- [ ] **Multi-photo:** take 3 full-res photos and extract → succeeds (proves compression keeps it under limits).
- [ ] **No data loss:** add several PharmAudit entries → hard-refresh the page → entries are still there.
- [ ] **Audit sync:** on two phones, create a session on one and join with the code on the other → entries appear live on both. The Firebase status dot shows "Live".
- [ ] **DB locked:** in the Firebase console, the rules are Published; an attempt to read the database root is denied.
- [ ] **Spend cap** is set in the Anthropic console.

---

## Brief the staff on these (known behaviors, not bugs)

- **Assign non-overlapping zones to auditors.** Two people counting the *same* shelf create two separate entries and the reviewer's variance will double-count. The app shows "✓ Counted" on items already done — tell auditors to watch for it.
- **Auditors must use unique names.** Two auditors with the same name overwrite each other's counts. Add an initial/number if needed.
- **PharmAudit auto-saves AI-extracted drugs into Brand Master.** If an extraction is wrong, fix it before submitting so the master data stays clean.
- **Export before clearing.** Use the PharmAudit Excel export and (for the Audit Tool) snapshot a session before closing it — closed Firebase sessions are not auto-deleted but shouldn't be relied on as permanent storage.

---

## Hosting on Netlify instead (alternative)

Vercel is recommended here mainly for the longer function timeout (multi-photo vision calls). If you prefer Netlify:
- Move `api/anthropic.js` to `netlify/functions/anthropic.js` and adapt it to Netlify's `exports.handler = async (event) => {...}` signature (read `event.headers['x-access-code']` and `JSON.parse(event.body)`; return `{ statusCode, body }`).
- Add a `netlify.toml` with `[build] publish="."`, `[functions] directory="netlify/functions"`, and a redirect so `/api/anthropic` maps to `/.netlify/functions/anthropic` (keeps the frontend code identical).
- Note Netlify's ~10s sync-function cap — keep photo counts modest. Set the same env vars in Netlify.
