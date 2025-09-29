from django.db import migrations, models


class Migration(migrations.Migration):

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
