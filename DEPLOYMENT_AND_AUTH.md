# Deployment and Auth Notes

This project is split into two browser-facing pieces:

- frontend: Vite/React
- backend: FastAPI JSON API

The login problem in the current deployment comes from cross-origin auth:
the frontend is not calling the correct API origin, and the refresh cookie
cannot be shared unless CORS and cookie settings match the deployment shape.

## What must be set

### Frontend
Set one of these at build time:

- `VITE_API_BASE_URL=https://your-backend-host`
- or `VITE_API_URL=https://your-backend-host`

Use the backend origin only, without `/api` at the end.

Examples:

- `https://sms-api.onrender.com`
- `https://your-clg-machine.example.com:8001`

If the frontend is hosted with a same-origin proxy for `/api`, then no base
URL is needed.

### Backend
Set these on the backend host:

- `SMS_ENV=production`
- `ALLOWED_ORIGINS=https://your-frontend-host`
- `SMS_COOKIE_SECURE=true`
- `SMS_COOKIE_SAMESITE=none`

`ALLOWED_ORIGINS` can contain more than one comma-separated origin.

Examples:

- `https://your-app.vercel.app`
- `https://your-app.web.app`

## Why this fixes login

The access token is kept in memory. The refresh token is stored in an
httpOnly cookie. After login or page reload, the SPA needs the browser to
send that cookie back to `/api/auth/refresh`.

That only works when all three are true:

1. The frontend is calling the real backend URL.
2. The backend allows the frontend origin in CORS with credentials enabled.
3. The refresh cookie is allowed in a cross-site context (`SameSite=None`
   plus `Secure` over HTTPS).

## Deployment order

1. Deploy backend first.
2. Copy the backend URL into the frontend build env.
3. Add the frontend URL into backend `ALLOWED_ORIGINS`.
4. Build and deploy the frontend.
5. Open the frontend and verify login, refresh, logout, and page reload.

## Runtime checklist

- Login should return JSON with `access_token`, `user`, and `redirect`.
- `/api/auth/refresh` should return a new access token after a reload.
- Browser devtools should show the refresh cookie as `HttpOnly`, `Secure`,
  and `SameSite=None` in production.
- If the frontend is deployed on a different domain, the browser network
  tab must show `credentials: include` requests to the backend URL.

## Files touched

- `frontend/src/api/client.ts`
- `api/app.py`
- `api/routes_auth.py`


## SMS Gateway Credential Hardening

Set `SMS_CREDENTIAL_KEY` to a stable Fernet key before creating or sending through SMS gateways. Generate one with:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

New gateway `password` and `device_id` values are encrypted at rest. API responses never return the raw values. Existing plaintext gateway credentials are deliberately not auto-migrated in this pass; editing a legacy cloud gateway requires re-entering its device ID and password, which writes ciphertext before the gateway can send.

## Published result deletion

Deleting an uploaded result is restricted to `ADMIN` users and requires a second confirmation key. The frontend sends the key in the `X-Result-Delete-Key` request header; it is never placed in the URL or audit log.

Set the backend environment variable before starting the API:

```env
RESULT_DELETE_KEY=choose-a-private-admin-delete-key
```

For local development, the backend falls back to `DELETE-RESULT` when the variable is not set. The permanent authorization boundary remains the `ADMIN` role check.

After updating the codebase, fully restart the Uvicorn process. `run_api.py` now performs a startup check that the `DELETE /api/results/admin/{batch_id}` route is registered and launches the concrete FastAPI app object, which avoids accidentally loading a stale `api.app` module from another working directory.
