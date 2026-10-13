"""Email delivery for authentication OTPs.

Supports SMTP, Resend, Brevo and SendGrid. Provider credentials are supplied
through environment variables; no secrets are stored in source code.

The important reliability rule here is that an API-provider failure must not
be reduced to a bare ``HTTPError``. The server logs the provider/status/reason
while the API returns a safe, stable error to the frontend. When more than
one provider is configured, the next configured provider is attempted before
failing the OTP request.
"""

from __future__ import annotations

import json
import os
import smtplib
import socket
import ssl
from email.message import EmailMessage
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

# Force IPv4 socket resolution for SMTP hosts to prevent cloud hosts from
# selecting an unreachable IPv6 route first.
_orig_getaddrinfo = socket.getaddrinfo


def _ipv4_only_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    if isinstance(host, str) and ("gmail" in host.lower() or "smtp" in host.lower()):
        try:
            return _orig_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)
        except socket.gaierror:
            pass
    return _orig_getaddrinfo(host, port, family, type, proto, flags)


socket.getaddrinfo = _ipv4_only_getaddrinfo

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


class EmailNotConfiguredError(RuntimeError):
    """Raised when no usable email provider is configured."""


class EmailDeliveryError(RuntimeError):
    """Raised after all configured email providers fail."""


def get_smtp_config():
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass

    host = os.environ.get("SMTP_HOST", "").strip()
    try:
        port = int(os.environ.get("SMTP_PORT", "587"))
    except ValueError:
        port = 587
    username = os.environ.get("SMTP_USERNAME", "").strip()
    password = os.environ.get("SMTP_PASSWORD", "").strip()
    if "gmail" in host.lower() or "gmail" in username.lower():
        password = password.replace(" ", "")
    from_email = os.environ.get("SMTP_FROM_EMAIL", "").strip() or username
    from_name = os.environ.get("SMTP_FROM_NAME", "VCET CSD SMS").strip()
    use_ssl = os.environ.get("SMTP_USE_SSL", "0").strip() == "1"
    use_tls = os.environ.get("SMTP_USE_TLS", "1").strip() == "1"
    return {
        "host": host,
        "port": port,
        "username": username,
        "password": password,
        "from_email": from_email,
        "from_name": from_name,
        "use_ssl": use_ssl,
        "use_tls": use_tls,
    }


def _smtp_configured(cfg) -> bool:
    return bool(cfg["host"] and cfg["username"] and cfg["password"])


def _provider_keys():
    return {
        "resend": os.environ.get("RESEND_API_KEY", "").strip(),
        "brevo": os.environ.get("BREVO_API_KEY", "").strip(),
        "sendgrid": os.environ.get("SENDGRID_API_KEY", "").strip(),
    }


def is_configured() -> bool:
    keys = _provider_keys()
    return bool(any(keys.values()) or _smtp_configured(get_smtp_config()))


def _safe_http_reason(exc: HTTPError) -> str:
    """Read an API error body for server logs without leaking it to clients."""
    try:
        raw = exc.read(4096).decode("utf-8", errors="replace").strip()
    except Exception:
        raw = ""
    if not raw:
        return f"HTTP {exc.code}"
    try:
        data = json.loads(raw)
        # Provider error bodies vary. Keep only a short human-readable field.
        for key in ("message", "error", "detail", "name"):
            value = data.get(key) if isinstance(data, dict) else None
            if value:
                return f"HTTP {exc.code}: {str(value)[:300]}"
        return f"HTTP {exc.code}: {raw[:300]}"
    except Exception:
        return f"HTTP {exc.code}: {raw[:300]}"


def _post_json(url: str, headers: dict[str, str], payload: dict, ok_statuses: set[int]) -> None:
    req = Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urlopen(req, timeout=15) as resp:
            if resp.status not in ok_statuses:
                raise EmailDeliveryError(f"unexpected HTTP status {resp.status}")
    except HTTPError:
        raise
    except (URLError, TimeoutError, OSError) as exc:
        raise EmailDeliveryError(f"network error: {type(exc).__name__}") from exc


def _send_resend(to_email: str, subject: str, body_text: str, api_key: str, cfg) -> None:
    # onboarding@resend.dev is a Resend test sender. For arbitrary recipients
    # in production, set RESEND_FROM_EMAIL to an address on a verified domain.
    from_email = os.environ.get("RESEND_FROM_EMAIL", "onboarding@resend.dev").strip()
    payload = {
        "from": f"{cfg['from_name']} <{from_email}>",
        "to": [to_email],
        "subject": subject,
        "text": body_text,
    }
    _post_json(
        "https://api.resend.com/emails",
        {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "NextGenSMS/1.0",
        },
        payload,
        {200, 201},
    )


def _send_brevo(to_email: str, subject: str, body_text: str, api_key: str, cfg) -> None:
    if not cfg["from_email"]:
        raise EmailDeliveryError("SMTP_FROM_EMAIL is required for Brevo")
    _post_json(
        "https://api.brevo.com/v3/smtp/email",
        {
            "api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "NextGenSMS/1.0",
        },
        {
            "sender": {"name": cfg["from_name"], "email": cfg["from_email"]},
            "to": [{"email": to_email}],
            "subject": subject,
            "textContent": body_text,
        },
        {200, 201},
    )


def _send_sendgrid(to_email: str, subject: str, body_text: str, api_key: str, cfg) -> None:
    if not cfg["from_email"]:
        raise EmailDeliveryError("SMTP_FROM_EMAIL is required for SendGrid")
    _post_json(
        "https://api.sendgrid.com/v3/mail/send",
        {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "NextGenSMS/1.0",
        },
        {
            "personalizations": [{"to": [{"email": to_email}]}],
            "from": {"email": cfg["from_email"], "name": cfg["from_name"]},
            "subject": subject,
            "content": [{"type": "text/plain", "value": body_text}],
        },
        {200, 202},
    )


def _send_smtp(to_email: str, subject: str, body_text: str, cfg) -> None:
    if not _smtp_configured(cfg):
        raise EmailNotConfiguredError(
            "SMTP is not configured. Set SMTP_HOST, SMTP_USERNAME and SMTP_PASSWORD."
        )

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{cfg['from_name']} <{cfg['from_email']}>"
    msg["To"] = to_email
    msg.set_content(body_text)

    if cfg["use_ssl"]:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(cfg["host"], cfg["port"], context=context, timeout=15) as server:
            server.login(cfg["username"], cfg["password"])
            server.send_message(msg)
        return

    with smtplib.SMTP(cfg["host"], cfg["port"], timeout=15) as server:
        if cfg["use_tls"]:
            context = ssl.create_default_context()
            server.starttls(context=context)
        server.login(cfg["username"], cfg["password"])
        server.send_message(msg)


def _provider_order() -> list[str]:
    configured = _provider_keys()
    cfg = get_smtp_config()
    provider = os.environ.get("EMAIL_PROVIDER", "auto").strip().lower()

    if provider not in {"auto", "resend", "brevo", "sendgrid", "smtp"}:
        print(f"[EMAIL] Invalid EMAIL_PROVIDER={provider!r}; using auto provider selection.")
        provider = "auto"

    if provider != "auto":
        return [provider]

    # Preserve compatibility with the previous preference order, but include
    # SMTP as a real fallback when it is configured.
    order = [name for name in ("resend", "brevo", "sendgrid") if configured[name]]
    if _smtp_configured(cfg):
        order.append("smtp")
    return order


def send_email(to_email: str, subject: str, body_text: str) -> None:
    cfg = get_smtp_config()
    keys = _provider_keys()
    providers = _provider_order()

    if not providers:
        raise EmailNotConfiguredError(
            "Email sending is not configured on this server. "
            "Set SMTP_HOST/SMTP_USERNAME/SMTP_PASSWORD or an email API key."
        )

    failures: list[str] = []
    for provider in providers:
        try:
            if provider == "resend":
                if not keys["resend"]:
                    raise EmailNotConfiguredError("RESEND_API_KEY is not configured")
                _send_resend(to_email, subject, body_text, keys["resend"], cfg)
            elif provider == "brevo":
                if not keys["brevo"]:
                    raise EmailNotConfiguredError("BREVO_API_KEY is not configured")
                _send_brevo(to_email, subject, body_text, keys["brevo"], cfg)
            elif provider == "sendgrid":
                if not keys["sendgrid"]:
                    raise EmailNotConfiguredError("SENDGRID_API_KEY is not configured")
                _send_sendgrid(to_email, subject, body_text, keys["sendgrid"], cfg)
            else:
                _send_smtp(to_email, subject, body_text, cfg)

            print(f"[EMAIL] {provider} delivery accepted for {to_email}")
            return
        except HTTPError as exc:
            reason = _safe_http_reason(exc)
            failures.append(f"{provider}: {reason}")
            print(f"[EMAIL] {provider} rejected email: {reason}")
        except EmailDeliveryError as exc:
            failures.append(f"{provider}: {exc}")
            print(f"[EMAIL] {provider} delivery failed: {exc}")
        except (smtplib.SMTPException, OSError, ssl.SSLError) as exc:
            failures.append(f"{provider}: {type(exc).__name__}: {exc}")
            print(f"[EMAIL] {provider} delivery failed: {type(exc).__name__}: {exc}")

    detail = "; ".join(failures)
    raise EmailDeliveryError(
        "All configured email providers failed. "
        "Check the provider credentials/sender configuration and server logs."
        + (f" Details: {detail}" if detail else "")
    )


def send_otp_email(to_email: str, code: str, purpose: str) -> None:
    """Send the OTP used for registration verification or password reset."""
    if purpose == "REGISTER":
        subject = "Verify your email — VCET CSD SMS"
        intro = "Use this code to verify your email and finish creating your account:"
    else:
        subject = "Password reset code — VCET CSD SMS"
        intro = "Use this code to reset your password:"

    body = (
        f"{intro}\n\n"
        f"    {code}\n\n"
        "This code expires in 10 minutes. If you didn't request this, "
        "you can safely ignore this email.\n"
    )
    send_email(to_email, subject, body)
