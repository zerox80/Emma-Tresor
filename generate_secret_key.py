import secrets
import string

def generate_secret_key(length=50):
    
    alphabet = string.ascii_letters + string.digits + '!@#$%^&*(-_=+)'
    return ''.join(secrets.choice(alphabet) for _ in range(length))

if __name__ == "__main__":
    secret_key = generate_secret_key()
    print("Neuer Django Secret Key:")
    print(secret_key)
    print("\nFüge das in deine .env Datei ein:")
    print(f"DJANGO_SECRET_KEY={secret_key}")
