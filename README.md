# Nespresso Inventory Counter

React + Vite frontend, Express API, Postgres. Runs as a single service on Railway: Express serves the API under `/api` and the built frontend.

## Environment variables

See [.env.example](.env.example).

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Reference the Railway Postgres variable. Schema is applied on startup. |
| `JWT_SECRET` | Long random string: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `ADMIN_EMAILS` | Comma-separated. These can sign up and access `/admin`. |
| `RESEND_API_KEY` | Optional. Without it, confirmation/reset links are printed to the server log. |
| `EMAIL_FROM` | Sender for Resend (needs a verified domain in production). |
| `APP_URL` | Public URL, used in email links, e.g. `https://your-app.up.railway.app`. |

## Local development

Needs a Postgres database (local, or a Railway one via its public URL).

```
cp .env.example .env   # fill in, then load into your shell
npm install
npm run dev            # API on :3000, Vite on :5173 (proxies /api)
```

## Deploy on Railway

1. New project, deploy from this GitHub repo.
2. Add a Postgres database to the project.
3. On the app service, set the variables above (`DATABASE_URL=${{Postgres.DATABASE_URL}}`).
4. Railway runs `npm run build` then `npm start`. Generate a domain under Settings, Networking.
