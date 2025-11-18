from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('inventory', '0010_rename_inventory_i_item_id_created_idx_inventory_i_item_id_752305_idx_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='DuplicateQuarantine',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('reason', models.CharField(blank=True, max_length=255)),
                ('notes', models.TextField(blank=True)),
                ('is_active', models.BooleanField(default=True)),
                ('item_a', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='duplicate_quarantined_primary', to='inventory.item')),
                ('item_b', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='duplicate_quarantined_secondary', to='inventory.item')),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='duplicate_quarantines', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='duplicatequarantine',
            constraint=models.UniqueConstraint(
                condition=models.Q(('is_active', True)),
                fields=('owner', 'item_a', 'item_b'),
                name='unique_active_duplicate_quarantine_pair',
            ),
        ),
    ]
