from django.db import migrations, models


class Migration(migrations.Migration):
    """Change ItemImage storage to the private media backend."""

    dependencies = [
        ("inventory", "0004_itemchangelog"),
    ]

    operations = [
        migrations.AlterField(
            model_name="itemimage",
            name="image",
            field=models.FileField(upload_to="item_attachments/"),
        ),
    ]
