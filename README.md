# SkillBridge

SkillBridge contains a Node.js and Express backend and a React frontend built with Vite.

## Run locally

1. In `backend`, install dependencies, copy `.env.example` to `.env`, fill in the values, and run `npm run dev`.
2. In `frontend`, install dependencies and run `npm run dev`.
3. Open `http://127.0.0.1:5173/app/`.

The Vite development server forwards `/api` requests to the backend on port `5001`. For the production-style setup, run `npm run build` in `frontend`, then start the backend; it serves the built app at `/app/`.

Never commit `backend/.env`. It contains local credentials and is ignored by Git.

## Deployment notes

The production setup serves the built frontend and `/api` from the same backend origin. Cross-origin browser access is disabled by default; set `CORS_ORIGINS` in the backend environment only if the frontend is hosted on a separate domain. If Node sits behind a reverse proxy, set `TRUST_PROXY_HOPS` to the exact number of trusted proxy hops so sign-in throttling can use the visitor's real IP. Keep the Node port private behind that proxy.

## Create a local administrator for testing

From the backend folder, run npm run admin:create. The script uses the configured database connection, asks for an email, and does not display password input. For an existing verified local student, it requires typing PROMOTE before granting admin access. For a new account, it asks for a name and password and requires typing CREATE before saving. Use http://127.0.0.1:5173/app/#/admin/login to sign in. Do not send the password in chat.
