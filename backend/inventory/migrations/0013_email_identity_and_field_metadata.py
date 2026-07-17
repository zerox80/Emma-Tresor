"""Enforce canonical login identities and align model field metadata."""

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


EMAIL_INDEX_NAME = 'inventory_auth_user_email_ci_uniq'
USERNAME_INDEX_NAME = 'inventory_auth_user_username_ci_uniq'


def normalize_emails_and_add_index(apps, schema_editor):
    app_label, model_name = settings.AUTH_USER_MODEL.split('.', 1)
    user_model = apps.get_model(app_label, model_name)

    seen = {}
    for user in user_model.objects.all().only('pk', 'email').iterator():
        normalized = (user.email or '').strip().lower()
        if normalized:
            existing_pk = seen.get(normalized)
            if existing_pk is not None:
                raise RuntimeError(
                    'Die Migration kann die E-Mail-Eindeutigkeit nicht herstellen: '
                    f'Benutzer {existing_pk} und {user.pk} haben dieselbe E-Mail-Adresse.'
                )
            seen[normalized] = user.pk
        if user.email != normalized:
            user_model.objects.filter(pk=user.pk).update(email=normalized)

    table = schema_editor.quote_name(user_model._meta.db_table)
    index = schema_editor.quote_name(EMAIL_INDEX_NAME)
    schema_editor.execute(
        f"CREATE UNIQUE INDEX {index} ON {table} (LOWER(email)) WHERE email <> ''"
    )

    usernames = {}
    for user in user_model.objects.all().only('pk', 'username').iterator():
        canonical = user.username.lower()
        existing_pk = usernames.get(canonical)
        if existing_pk is not None:
            raise RuntimeError(
                'Die Migration kann die Benutzernamen-Eindeutigkeit nicht herstellen: '
                f'Benutzer {existing_pk} und {user.pk} unterscheiden sich nur in Groß-/Kleinschreibung.'
            )
        usernames[canonical] = user.pk

    username_index = schema_editor.quote_name(USERNAME_INDEX_NAME)
    schema_editor.execute(
        f'CREATE UNIQUE INDEX {username_index} ON {table} (LOWER(username))'
    )


def remove_email_index(apps, schema_editor):
    username_index = schema_editor.quote_name(USERNAME_INDEX_NAME)
    index = schema_editor.quote_name(EMAIL_INDEX_NAME)
    schema_editor.execute(f'DROP INDEX IF EXISTS {username_index}')
    schema_editor.execute(f'DROP INDEX IF EXISTS {index}')


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0012_item_employee_name_item_room_number'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterField(
            model_name='location',
            name='user',
            field=models.ForeignKey(
                help_text='The user who owns this location',
                on_delete=django.db.models.deletion.CASCADE,
                related_name='locations',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AlterField(
            model_name='tag',
            name='user',
            field=models.ForeignKey(
                help_text='The user who owns this tag',
                on_delete=django.db.models.deletion.CASCADE,
                related_name='tags',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(normalize_emails_and_add_index, remove_email_index),
    ]
