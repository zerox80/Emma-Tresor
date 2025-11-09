#!/usr/bin/env python3
"""
Django Secret Key Generator
==========================

This script generates cryptographically secure random keys for Django applications.
Django uses secret keys for cryptographic signing of sessions, password reset tokens,
and other security-related features.

Security Requirements:
- Keys must be at least 50 characters long
- Must use a cryptographically secure random number generator
- Should contain letters, numbers, and special characters for maximum entropy

Usage:
    python generate_secret_key.py
    
Output:
    Prints a new secret key and the exact line to add to .env file
"""

import secrets                    # Cryptographically secure random number generator
import string                     # String constants for character sets

def generate_secret_key(length=50):
    """
    Generate a cryptographically secure random secret key.
    
    Args:
        length (int): Length of the key to generate. Defaults to 50 characters.
                     Django recommends minimum 50 characters for security.
    
    Returns:
        str: Randomly generated secret key containing letters, digits, and special characters
    """
    
    # Define the character set for the secret key
    # string.ascii_letters: All uppercase and lowercase letters (a-zA-Z)
    # string.digits: All numeric digits (0-9)
    # '!@#$%^&*(-_=+)': Special characters that are safe for environment variables
    alphabet = string.ascii_letters + string.digits + '!@#$%^&*(-_=+)'
    
    # Generate the secret key using cryptographically secure random selection
    # secrets.choice(): Randomly select one character from alphabet securely
    # for _ in range(length): Repeat this operation 'length' times
    # ''.join(): Join all selected characters into a single string
    return ''.join(secrets.choice(alphabet) for _ in range(length))

# Script execution guard
# =====================
# This ensures the code below only runs when the script is executed directly,
# not when it's imported as a module into another Python file.
if __name__ == "__main__":
    
    # Generate a new secret key using the default length of 50 characters
    secret_key = generate_secret_key()
    
    # Print the generated key to the console
    # Using German text to match the existing output in the project
    print("Neuer Django Secret Key:")      # "New Django Secret Key:" in German
    print(secret_key)                      # Print the actual secret key
    
    # Print instructions for adding the key to the environment file
    print("\nFüge das in deine .env Datei ein:")  # "Add this to your .env file:" in German
    print(f"DJANGO_SECRET_KEY={secret_key}")     # Print the exact line to add to .env
