import django.core.validators
from django.db import migrations, models
import inventory.storage


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0008_add_missing_indexes"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="item",
            options={
                "ordering": ["name"],
                "verbose_name": "Gegenstand",
                "verbose_name_plural": "Gegenstände",
            },
        ),
        migrations.AlterModelOptions(
            name="itemimage",
            options={
                "verbose_name": "Gegenstandsbild",
                "verbose_name_plural": "Gegenstandsbilder",
            },
        ),
        migrations.AlterModelOptions(
            name="itemlist",
            options={
                "ordering": ["name"],
                "verbose_name": "Inventarliste",
                "verbose_name_plural": "Inventarlisten",
            },
        ),
        migrations.AlterModelOptions(
            name="location",
            options={
                "ordering": ["name"],
                "verbose_name": "Standort",
                "verbose_name_plural": "Standorte",
            },
        ),
        migrations.AlterModelOptions(
            name="tag",
            options={
                "ordering": ["name"],
                "verbose_name": "Schlagwort",
                "verbose_name_plural": "Schlagwörter",
            },
        ),
        migrations.AlterField(
            model_name="item",
            name="quantity",
            field=models.PositiveIntegerField(
                default=1,
                validators=[
                    django.core.validators.MinValueValidator(1),
                    django.core.validators.MaxValueValidator(999999),
                ],
            ),
        ),
        migrations.AlterField(
            model_name="itemimage",
            name="image",
            field=models.FileField(
                storage=inventory.storage.PrivateMediaStorage,
                upload_to="item_attachments/",
            ),
        ),
    ]
