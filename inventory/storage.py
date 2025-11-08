from django.conf import settings
from django.core.files.storage import FileSystemStorage


class PrivateMediaStorage(FileSystemStorage):
    """A file storage backend for private media.

    This storage backend stores files in a directory that is not publicly
    accessible via a URL. This is useful for sensitive files, such as
    receipts or other private documents.

    The location of the private media directory is configured by the
    `PRIVATE_MEDIA_ROOT` setting.
    """

    def __init__(self, *args, **kwargs):
        """
        Initializes the private media storage.
        """
        location = kwargs.pop('location', getattr(settings, 'PRIVATE_MEDIA_ROOT', settings.MEDIA_ROOT))
        # Private files are not served via MEDIA_URL; base_url stays None
        super().__init__(location=location, base_url=None, *args, **kwargs)


private_item_storage = PrivateMediaStorage()
