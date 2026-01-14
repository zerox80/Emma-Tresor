# Generated migration for adding employee_name and room_number fields to Item model

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0011_duplicatequarantine'),
    ]

    operations = [
        migrations.AddField(
            model_name='item',
            name='employee_name',
            field=models.CharField(
                blank=True,
                help_text='Name des Mitarbeiters, dem der Gegenstand zugeordnet ist',
                max_length=255,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='item',
            name='room_number',
            field=models.CharField(
                blank=True,
                help_text='Raumnummer, in der sich der Gegenstand befindet',
                max_length=50,
                null=True,
            ),
        ),
    ]
