import uuid

from django.db import migrations, models


def populate_asset_tags(apps, schema_editor):
    Item = apps.get_model('inventory', 'Item')
    for item in Item.objects.filter(asset_tag__isnull=True):
        item.asset_tag = uuid.uuid4()
        item.save(update_fields=['asset_tag'])


def remove_asset_tags(apps, schema_editor):
    Item = apps.get_model('inventory', 'Item')
    Item.objects.update(asset_tag=None)


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='item',
            name='asset_tag',
            field=models.UUIDField(editable=False, null=True),
        ),
        migrations.RunPython(populate_asset_tags, remove_asset_tags),
        migrations.AlterField(
            model_name='item',
            name='asset_tag',
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
    ]
