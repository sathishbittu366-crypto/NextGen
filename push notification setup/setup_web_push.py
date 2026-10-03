#!/usr/bin/env python3
"""Set up VAPID credentials for NextGen SMS Web Push.

This script generates a fresh P-256 VAPID keypair and writes the server-side
configuration expected by the Web Push subsystem into the project's .env.

It does not modify application source code and never writes the private key to
frontend files.

Usage:
    python setup_web_push.py
    python setup_web_push.py --project-root "C:/path/to/nextgen_work"
    python setup_web_push.py --email admin@example.com
    python setup_web_push.py --force

Requirements:
    pip install cryptography python-dotenv
"""
from __future__ import annotations

import argparse
import base64
import os
import re
import stat
import sys
from pathlib import Path

try:
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ec
except ImportError:
    print("ERROR: cryptography is not installed.")
    print("Run: python -m pip install cryptography")
    raise SystemExit(1)


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def find_project_root(explicit: str | None) -> Path:
    if explicit:
        root = Path(explicit).expanduser().resolve()
        if not root.exists() or not root.is_dir():
            raise SystemExit(f"ERROR: project root does not exist: {root}")
        return root

    here = Path.cwd().resolve()
    candidates = [here, *here.parents]
    for candidate in candidates:
        # NextGen SMS has both requirements.txt and the api/ directory.
        if (candidate / "requirements.txt").exists() and (candidate / "api").is_dir():
            return candidate
    return here


def read_env(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def env_value(text: str, key: str) -> str | None:
    pattern = re.compile(rf"(?m)^\s*{re.escape(key)}\s*=\s*(.*?)\s*$")
    match = pattern.search(text)
    if not match:
        return None
    value = match.group(1).strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        value = value[1:-1]
    return value


def upsert_env(text: str, values: dict[str, str]) -> str:
    newline = "\r\n" if "\r\n" in text else "\n"
    # Keep all existing content and replace only the named assignments.
    for key, value in values.items():
        line = f"{key}={value}"
        pattern = re.compile(rf"(?m)^\s*{re.escape(key)}\s*=.*$")
        if pattern.search(text):
            text = pattern.sub(line, text, count=1)
        else:
            if text and not text.endswith(("\n", "\r")):
                text += newline
            text += line + newline
    return text


def generate_vapid_pair() -> tuple[str, bytes]:
    """Return (public_key_b64url, private_key_pem)."""
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key = private_key.public_key()

    # Web Push VAPID public keys use the uncompressed SEC1 P-256 point,
    # encoded with URL-safe base64 without padding.
    public_bytes = public_key.public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint,
    )

    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    return b64url(public_bytes), private_pem


def write_private_key(path: Path, pem: bytes, force: bool) -> None:
    if path.exists() and not force:
        raise SystemExit(
            f"ERROR: refusing to overwrite existing private key: {path}\n"
            "Use --force only when you intentionally want a new keypair."
        )
    path.write_bytes(pem)
    if os.name != "nt":
        path.chmod(stat.S_IRUSR | stat.S_IWUSR)


def main() -> int:
    parser = argparse.ArgumentParser(description="Configure VAPID credentials for NextGen SMS Web Push.")
    parser.add_argument("--project-root", help="NextGen project directory. Defaults to the current project root.")
    parser.add_argument("--email", default="", help="Email used in the VAPID contact claim, e.g. admin@example.com")
    parser.add_argument("--force", action="store_true", help="Generate and write a new keypair even when credentials already exist.")
    args = parser.parse_args()

    root = find_project_root(args.project_root)
    env_path = root / ".env"
    key_path = root / "vapid-private.pem"

    existing_env = read_env(env_path)
    existing_public = env_value(existing_env, "VAPID_PUBLIC_KEY")
    existing_private = env_value(existing_env, "VAPID_PRIVATE_KEY")
    existing_claims = env_value(existing_env, "VAPID_CLAIMS_SUB")

    if existing_public and existing_private and not args.force:
        print("VAPID credentials already exist in .env; nothing changed.")
        print(f"Project: {root}")
        print(f"Public key: {existing_public[:16]}...")
        return 0

    public_key, private_pem = generate_vapid_pair()
    write_private_key(key_path, private_pem, force=args.force)

    # The backend can read the private key from a PEM file, avoiding a long
    # multiline private-key value inside .env and keeping secrets server-side.
    claim = args.email.strip() or existing_claims or "mailto:admin@nextgensms.local"
    values = {
        "VAPID_PUBLIC_KEY": public_key,
        "VAPID_PRIVATE_KEY": str(key_path),
        "VAPID_CLAIMS_SUB": claim,
    }
    updated_env = upsert_env(existing_env, values)
    env_path.write_text(updated_env, encoding="utf-8")

    print("Web Push VAPID setup complete.")
    print(f"Project root : {root}")
    print(f".env         : {env_path}")
    print(f"Private key  : {key_path}")
    print(f"Public key   : {public_key}")
    print(f"Claims email : {claim}")
    print()
    print("Next steps:")
    print("1. Ensure your backend Web Push dependency is installed (pywebpush).")
    print("2. Restart the FastAPI backend so it loads the new environment values.")
    print("3. Serve the frontend over HTTPS in production (localhost is okay for local development).")
    print("4. Open Notifications and click Enable under Browser notifications.")
    print()
    print("SECURITY: keep vapid-private.pem and .env out of Git and never expose the private key to the frontend.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
