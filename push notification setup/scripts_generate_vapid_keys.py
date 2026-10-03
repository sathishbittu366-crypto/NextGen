"""Generate VAPID credentials for NextGen SMS Web Push.

Usage:
    python scripts_generate_vapid_keys.py

Keep the printed private key secret. Put it in the backend environment as
VAPID_PRIVATE_KEY. The public key is safe to expose to the browser through the
/api/notifications/config endpoint.
"""
from __future__ import annotations

import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def b64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


key = ec.generate_private_key(ec.SECP256R1())
private_pem = key.private_bytes(
    serialization.Encoding.PEM,
    serialization.PrivateFormat.PKCS8,
    serialization.NoEncryption(),
).decode("utf-8").strip()
public_raw = key.public_key().public_bytes(
    serialization.Encoding.X962,
    serialization.PublicFormat.UncompressedPoint,
)

print("VAPID_PUBLIC_KEY=" + b64url(public_raw))
print("VAPID_PRIVATE_KEY_PEM_BEGIN")
print(private_pem)
print("VAPID_PRIVATE_KEY_PEM_END")
print("VAPID_CLAIMS_SUB=mailto:admin@example.com")
