# NextGen SMS — OTP Email Setup

The password-reset and registration OTP endpoints use `email_service.py`.
The backend supports SMTP, Resend, Brevo and SendGrid.

## Recommended: Gmail SMTP for the college/local backend

Use a Gmail **App Password**, not the normal Gmail account password.

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-account@gmail.com
SMTP_PASSWORD=your-16-character-app-password
SMTP_FROM_EMAIL=your-account@gmail.com
SMTP_FROM_NAME=VCET CSD SMS
SMTP_USE_SSL=0
SMTP_USE_TLS=1
```

For Gmail, enable 2-Step Verification on the sending Google account and create
an App Password. Do not commit the real password or `.env` file.

## Resend

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxx
RESEND_FROM_EMAIL=no-reply@your-verified-domain.example
SMTP_FROM_NAME=VCET CSD SMS
```

`onboarding@resend.dev` is retained as the default test sender. For normal
production delivery to arbitrary student email addresses, use a sender on a
verified Resend domain.

## Brevo

```env
EMAIL_PROVIDER=brevo
BREVO_API_KEY=xkeysib-xxxxxxxxx
SMTP_FROM_EMAIL=your-verified-sender@example.com
SMTP_FROM_NAME=VCET CSD SMS
```

## SendGrid

```env
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxxx
SMTP_FROM_EMAIL=your-verified-sender@example.com
SMTP_FROM_NAME=VCET CSD SMS
```

## Automatic fallback

If `EMAIL_PROVIDER=auto` (the default), the backend tries configured API
providers and then SMTP if it is configured. This means a stale/broken API key
will not prevent OTP delivery when a working SMTP configuration is available.

If a provider rejects the request, the backend logs the HTTP status and the
provider's short error reason. The browser still receives the safe
`EMAIL_SEND_FAILED` response and never receives provider credentials or raw
provider diagnostics.

## Important

After changing environment variables, **restart the backend process**. A
running Uvicorn process does not automatically receive new shell environment
values.
