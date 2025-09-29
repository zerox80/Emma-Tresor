from django.db import migrations, models
import inventory.storage


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0006_alter_item_description"),
    ]

    operations = [
        migrations.AlterField(
            model_name="itemimage",
            name="image",
            field=models.FileField(
                storage=inventory.storage.PrivateMediaStorage,
                upload_to="item_attachments/"
            ),
        ),
    ]
