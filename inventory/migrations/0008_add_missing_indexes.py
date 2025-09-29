import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0007_alter_itemimage_image"),
    ]

    operations = [
        # Add missing db_index to asset_tag
        migrations.AlterField(
            model_name="item",
            name="asset_tag",
            field=models.UUIDField(
                db_index=True,
                default=uuid.uuid4,
                editable=False,
                unique=True
            ),
        ),
        # Add missing indexes to ItemChangeLog
        migrations.AddIndex(
            model_name="itemchangelog",
            index=models.Index(fields=["item", "-created_at"], name="inventory_i_item_id_created_idx"),
        ),
        migrations.AddIndex(
            model_name="itemchangelog",
            index=models.Index(fields=["user", "-created_at"], name="inventory_i_user_id_created_idx"),
        ),
        migrations.AddIndex(
            model_name="itemchangelog",
            index=models.Index(fields=["action", "-created_at"], name="inventory_i_action_created_idx"),
        ),
    ]
