# Django REST Framework Serializers for Inventory API
# ====================================================
# This module defines all serializers that convert between Python objects and JSON
# for the REST API. Serializers handle:
# - Data validation (ensuring input meets requirements)
# - Data transformation (Python objects <-> JSON)
# - Security controls (user isolation, permission checks)
# - Field-level access control (read-only, write-only fields)
#
# Each serializer corresponds to a model and includes comprehensive validation
# to ensure data integrity and security.

from django.contrib.auth import get_user_model                      # Get configured User model
from django.contrib.auth.password_validation import validate_password  # Django password validators
from django.core.exceptions import ValidationError                  # Django validation errors
from django.db import IntegrityError, transaction
from rest_framework import serializers                              # DRF serializers
from rest_framework.validators import UniqueValidator               # Unique field validators
from rest_framework.reverse import reverse                          # URL generation
import mimetypes                                                    # MIME type detection
import os                                                           # File path operations
import bleach                                                       # HTML sanitization
from django.utils.html import strip_tags                            # HTML tag removal

# Import models and constants
from .models import (
    Item,
    ItemImage,
    ItemChangeLog,
    ItemList,
    Location,
    Tag,
    MAX_PURCHASE_AGE_YEARS,
    DuplicateQuarantine,
)

# Get the User model (either Django's default or custom model)
User = get_user_model()
class UserRegistrationSerializer(serializers.ModelSerializer):
    """
    Serializer for user registration endpoint.

    Handles new user account creation with comprehensive validation:
    - Email uniqueness checking (case-insensitive)
    - Password strength validation using Django's validators
    - Password confirmation matching
    - Secure password storage using hashing

    Security features:
    - Passwords are write-only (never returned in API responses)
    - Email normalization (lowercase, trimmed)
    - Comprehensive error messages in German
    """

    # Email field with unique validation (case-insensitive)
    email = serializers.EmailField(
        required=True,
        validators=[UniqueValidator(
            queryset=User.objects.all(),
            lookup='iexact',  # Case-insensitive uniqueness check
            message=(
                'Ein Konto mit dieser E-Mail-Adresse existiert bereits. Bitte verwende eine andere '
                'E-Mail-Adresse oder melde dich mit deinem bestehenden Konto an.'
            )
        )],
    )

    username = serializers.CharField(
        max_length=User._meta.get_field('username').max_length,
        validators=[
            *User._meta.get_field('username').validators,
            UniqueValidator(
                queryset=User.objects.all(),
                lookup='iexact',
                message='Dieser Benutzername wird bereits verwendet.',
            ),
        ],
    )

    # Password field (write-only for security)
    password = serializers.CharField(write_only=True)

    # Password confirmation field (write-only, not stored in database)
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        # Fields exposed in the API
        fields = ['id', 'username', 'email', 'password', 'password_confirm']
        # ID is auto-generated, cannot be set by client
        read_only_fields = ['id']

    def validate(self, attrs):
        """
        Validate user registration data.

        Performs several validation checks:
        1. Password and password_confirm must match
        2. Email is normalized (lowercase, trimmed)
        3. Password meets Django's security requirements

        Args:
            attrs: Dictionary of field values from the request

        Returns:
            dict: Validated and normalized attributes

        Raises:
            serializers.ValidationError: If validation fails
        """
        # Extract passwords for validation
        password = attrs.get('password')
        password_confirm = attrs.pop('password_confirm', None)

        # Ensure passwords match
        if password != password_confirm:
            raise serializers.ValidationError({'password_confirm': 'Die Passwörter stimmen nicht überein.'})

        # Normalize email (lowercase and trim whitespace)
        email = attrs.get('email')
        if email:
            attrs['email'] = email.strip().lower()

        # Validate password strength using Django's validators
        # This checks for: minimum length, common passwords, numeric-only, similarity to user attributes
        try:
            candidate_user = User(
                username=attrs.get('username', ''),
                email=attrs.get('email', ''),
            )
            validate_password(password, user=candidate_user)
        except ValidationError as e:
            # Django validation errors - convert to DRF format
            raise serializers.ValidationError({'password': list(e.messages)})
        except Exception as e:
            # Unexpected errors - return generic message
            raise serializers.ValidationError({'password': 'Passwort entspricht nicht den Sicherheitsstandards.'})

        return attrs

    def create(self, validated_data):
        """
        Create a new user account.

        Extracts the password, creates the user object, and properly hashes
        the password using Django's secure password hashing.

        Args:
            validated_data: Validated data from validate() method

        Returns:
            User: The newly created user instance

        Raises:
            Exception: If user creation fails (re-raised after cleanup)
        """
        # Extract password from validated data
        password = validated_data.pop('password')

        # Create user object (without password yet)
        user = User(**validated_data)

        # Hash and set the password securely
        # Django uses Argon2 by default (configured in settings.py)
        user.set_password(password)

        try:
            with transaction.atomic():
                user.save()
        except IntegrityError as exc:
            # The database constraint is the final authority and closes the
            # race between validation and insertion.
            errors = {}
            if User.objects.filter(username__iexact=user.username).exists():
                errors['username'] = 'Dieser Benutzername wird bereits verwendet.'
            if user.email and User.objects.filter(email__iexact=user.email).exists():
                errors['email'] = 'Ein Konto mit dieser E-Mail-Adresse existiert bereits.'
            if not errors:
                errors['non_field_errors'] = 'Das Konto konnte wegen eines Datenkonflikts nicht erstellt werden.'
            raise serializers.ValidationError(errors) from exc

        return user
