from django.conf import settings
from django.core.files.storage import FileSystemStorage

class PrivateMediaStorage(FileSystemStorage):

    def __init__(self, *args, **kwargs):
        location = kwargs.pop('location', getattr(settings,
            'PRIVATE_MEDIA_ROOT', settings.MEDIA_ROOT))
        super().__init__(*args, location=location, base_url=None, **kwargs)

private_item_storage = PrivateMediaStorage()
