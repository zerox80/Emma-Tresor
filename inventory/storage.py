from django.conf import settings
from django.core.files.storage import FileSystemStorage


class PrivateMediaStorage(FileSystemStorage):
    """A file storage backend for private media.

    This storage backend stores files in a directory that is not publicly
    accessible via a URL. This is useful for sensitive files, such as
    receipts or other private documents.

    The location of the private media directory is configured by
    `PRIVATE_MEDIA_ROOT` setting. Files stored using this backend
    can only be accessed through controlled views that verify
    user permissions.
    """

    def __init__(self, *args, **kwargs):
        """Initializes private media storage.

        Args:
            *args: Variable length argument list passed to parent.
            **kwargs: Arbitrary keyword arguments passed to parent.
                Can include 'location' to override the default storage path.
        """
        location = kwargs.pop('location', getattr(settings, 'PRIVATE_MEDIA_ROOT', settings.MEDIA_ROOT))
        # Private files are not served via MEDIA_URL; base_url stays None
        super().__init__(location=location, base_url=None, *args, **kwargs)


# Default instance of private media storage for item attachments
private_item_storage = PrivateMediaStorage()
