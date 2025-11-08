from django.conf import settings
from django.core.files.storage import FileSystemStorage


class PrivateMediaStorage(FileSystemStorage):
    """
    A file storage backend that stores files in a private directory, outside of the public MEDIA_ROOT.
    This is used for files that should not be publicly accessible via a URL.
    """

    def __init__(self, *args, **kwargs):
        """
        Initializes the private media storage.
        """
        location = kwargs.pop('location', getattr(settings, 'PRIVATE_MEDIA_ROOT', settings.MEDIA_ROOT))
        # Private files are not served via MEDIA_URL; base_url stays None
        super().__init__(location=location, base_url=None, *args, **kwargs)


private_item_storage = PrivateMediaStorage()
