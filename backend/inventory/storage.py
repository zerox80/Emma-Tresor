# Private Media Storage Backend
# =============================
# This custom storage backend provides secure file storage for sensitive media files.
# Unlike regular media storage, private media files are not directly accessible via URL
# and require authentication to access, providing an additional layer of security.

from django.conf import settings                         # Django settings configuration
from django.core.files.storage import FileSystemStorage   # Django's basic file system storage

class PrivateMediaStorage(FileSystemStorage):
    """
    Custom storage backend for private media files.

    This storage class extends Django's FileSystemStorage to handle private media files
    that should not be directly accessible via URL. Key features:

    1. Files are stored in a separate directory from public media
    2. No public URL is generated for stored files
    3. Files require authentication and proper view logic to access
    4. Used for sensitive files like item attachments that need access control

    This is particularly useful for:
    - User-uploaded files that should only be accessible to the owner
    - Sensitive documents that need authentication
    - Files that require download logging or access tracking
    """

    def __init__(self, *args, **kwargs):
        """
        Initialize the private media storage backend.

        Sets up the storage location and disables URL generation to ensure
        files cannot be accessed directly via URL.

        Args:
            *args: Positional arguments passed to parent class
            **kwargs: Keyword arguments, with 'location' extracted for storage path
        """
        # Determine the storage location for private files
        # Priority order:
        # 1. Explicit location passed in kwargs
        # 2. PRIVATE_MEDIA_ROOT setting from Django settings
        # 3. Default to regular MEDIA_ROOT as fallback
        location = kwargs.pop('location', getattr(settings, 'PRIVATE_MEDIA_ROOT', settings.MEDIA_ROOT))

        # Initialize parent FileSystemStorage with custom configuration
        # - location: Directory where files will be stored
        # - base_url=None: Disables URL generation for security
        # - *args, **kwargs: Pass through any other arguments
        super().__init__(*args, location=location, base_url=None, **kwargs)

# Global instance of the private media storage
# ===========================================
# This singleton instance is used throughout the application for storing
# private media files that require authentication to access.
# Example usage: item_image.image = private_item_storage.save('filename.jpg', file)
private_item_storage = PrivateMediaStorage()
