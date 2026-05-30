# YagnaMed v3 — Pharmacy Intelligence Suite

A browser-based pharmacy inventory & drug-management app: Brand Master, Drug Enrichment (AI),
Molecule Mapper, PharmAudit (photo → AI extraction), and a real-time multi-auditor Audit Tool.

## Production architecture

- **`index.html`** — the app (vanilla JS SPA), served as a static site.
- **`api/anthropic.js`** — serverless proxy for the Anthropic API. Keeps the shared API key
  server-side and gates access with a pharmacy passcode. The browser never sees the key.
- **`database.rules.json`** — Firebase Realtime Database security rules (audit tool).
- **`vercel.json` / `.env.example`** — hosting config and the env vars to set.

## Deploying

Follow **[DEPLOY.md](DEPLOY.md)** — it walks through Anthropic, Firebase, GitHub, and Vercel
setup, plus a pre-launch test checklist and notes to brief pharmacy staff on.

## Local note

This app is meant to be **hosted** (HTTPS is required for the phone camera, and the AI proxy
needs the serverless function). Opening `index.html` directly from disk will load the UI but
AI features and the audit tool will not work — deploy it instead.
