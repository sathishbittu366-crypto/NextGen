from __future__ import annotations

import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def test_notification_endpoint_validation():
    from sms_app.services.notification_service import _validate_endpoint

    assert _validate_endpoint("https://push.example.test/abc") == "https://push.example.test/abc"
    for value in ("http://push.example.test/abc", "not-a-url", "ftp://push.example.test/abc"):
        try:
            _validate_endpoint(value)
        except ValueError:
            pass
        else:
            raise AssertionError(f"Expected endpoint validation failure for {value!r}")


def test_vapid_public_key_is_derived_in_browser_format(monkeypatch):
    from sms_app.services import notification_service

    key = ec.generate_private_key(ec.SECP256R1())
    private_pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode("utf-8")
    monkeypatch.setenv("VAPID_PRIVATE_KEY", private_pem)
    monkeypatch.setenv("VAPID_CLAIMS_SUB", "mailto:test@example.com")
    monkeypatch.delenv("VAPID_PUBLIC_KEY", raising=False)

    public_key = notification_service.get_vapid_public_key()
    assert public_key
    padded = public_key + "=" * ((4 - len(public_key) % 4) % 4)
    raw = base64.urlsafe_b64decode(padded)
    assert len(raw) == 65
    assert raw[0] == 4  # uncompressed P-256 point marker
