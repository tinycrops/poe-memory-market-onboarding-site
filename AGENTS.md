# Frontend Agent Guide (Public Repo)

## Scope
This repo contains only the public onboarding website for PoE Memory+Market.

Do work only on static frontend files:
- `index.html`
- `styles.css`
- `app.js`
- `config.js`

## Objective
Maintain a clear onboarding page that:
- collects account + realm + character + contact,
- calls the backend API,
- renders preview output,
- captures interest feedback.

## API Integration
Frontend expects backend endpoints:
- `GET /api/health`
- `POST /api/onboard/run`
- `POST /api/onboard/interest`

Base URL is set in `config.js` via:
```js
window.__API_BASE__ = "https://...";
```

## Guardrails
- Do not add secrets to this repo.
- Do not include backend code here.
- Keep this repo safe for public visibility.
- Preserve request/response compatibility unless coordinated with backend changes.

## Local Preview
```bash
python3 -m http.server 8080
```
Open `http://127.0.0.1:8080`.

## Deploy
This repo is deployed with GitHub Pages from `master` root.
Public URL:
- `https://tinycrops.github.io/poe-memory-market-onboarding-site/`

## When Changing Forms
If form fields are changed:
1. Update HTML inputs.
2. Update payload construction in `app.js`.
3. Confirm backend contract still matches.

## Quality Bar
- Keep copy concise and outcome-focused.
- Ensure mobile layout remains usable.
- Show clear error states when API calls fail.
