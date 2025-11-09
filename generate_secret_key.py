#!/usr/bin/env python3
"""
Django Secret Key Generator
Generiert einen sicheren Secret Key für Django
"""

import secrets
import string

def generate_secret_key(length=50):
    """Generates a secure Django secret key.

    This function generates a cryptographically secure random string suitable
    for use as Django's SECRET_KEY setting. The key contains a mix of
    alphanumeric characters and special characters to ensure strong entropy.

    Args:
        length (int, optional): The length of the secret key to generate.
            Defaults to 50 characters, which is Django's recommended minimum.

    Returns:
        str: A cryptographically secure random string suitable for use as
            Django's SECRET_KEY.
    """
    alphabet = string.ascii_letters + string.digits + '!@#$%^&*(-_=+)'
    return ''.join(secrets.choice(alphabet) for _ in range(length))

if __name__ == "__main__":
    secret_key = generate_secret_key()
    print("Neuer Django Secret Key:")
    print(secret_key)
    print("\nFüge das in deine .env Datei ein:")
    print(f"DJANGO_SECRET_KEY={secret_key}")
