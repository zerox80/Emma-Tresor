from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0005_alter_itemimage_image"),
    ]

    operations = [
        migrations.AlterField(
            model_name="item",
            name="description",
            field=models.TextField(blank=True, null=True),
        ),
    ]
