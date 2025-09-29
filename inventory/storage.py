from django.conf import settings
from django.core.files.storage import FileSystemStorage


class PrivateMediaStorage(FileSystemStorage):
    """File storage that keeps media files outside the public MEDIA_ROOT."""

    def __init__(self, *args, **kwargs):
        location = kwargs.pop('location', getattr(settings, 'PRIVATE_MEDIA_ROOT', settings.MEDIA_ROOT))
        # Private files are not served via MEDIA_URL; base_url stays None
        super().__init__(location=location, base_url=None, *args, **kwargs)


private_item_storage = PrivateMediaStorage()
