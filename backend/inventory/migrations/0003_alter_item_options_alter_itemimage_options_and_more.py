from django.db import migrations


class Migration(migrations.Migration):
    """Adjust ordering, verbose names, and file settings for inventory models."""

    dependencies = [
        ('inventory', '0002_item_asset_tag'),
    ]

    operations = []
