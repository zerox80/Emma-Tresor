from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from inventory.models import Item, ItemImage, Tag, Location
from datetime import date, timedelta
from django.core.files.uploadedfile import SimpleUploadedFile
import os
from PIL import Image
from io import BytesIO
from unittest import mock

User = get_user_model()

class BaseModelTestCase(TestCase):

    @classmethod
    def setUpTestData(cls):
        
        cls.user = User.objects.create_user(username='testuser', password='password')

class ItemModelTests(BaseModelTestCase):

    def test_purchase_date_in_future_raises_error(self):
        
        future_date = date.today() + timedelta(days=1)
        item = Item(name='Test Item', owner=self.user, purchase_date=future_date)
        with self.assertRaises(ValidationError):
            item.clean()

    def test_purchase_date_too_old_raises_error(self):
        
        old_date = date.today() - timedelta(days=365 * 51)
        item = Item(name='Test Item', owner=self.user, purchase_date=old_date)
        with self.assertRaises(ValidationError):
            item.clean()

    def test_negative_value_raises_error(self):
        
        item = Item(name='Test Item', owner=self.user, value=-100)
        with self.assertRaises(ValidationError):
            item.clean()

    def test_value_too_high_raises_error(self):
        
        item = Item(name='Test Item', owner=self.user, value=1000000000)
        with self.assertRaises(ValidationError):
            item.clean()

    def test_wodis_inventory_number_strips_whitespace(self):
        
        item = Item(name='Test Item', owner=self.user, wodis_inventory_number='  W- 123  ')
        item.full_clean()
        self.assertEqual(item.wodis_inventory_number, 'W- 123')

class ItemImageModelTests(BaseModelTestCase):

    def setUp(self):
        
        self.item = Item.objects.create(name='Test Item for Image', owner=self.user)

    def _create_image_file(self, name='test.png', size_kb=10, content_type='image/png'):
        
        file_content = b'A' * 1024 * size_kb
        return SimpleUploadedFile(name, file_content, content_type=content_type)

    def _create_real_image_file(self, name='test.png', ext='png', width=10, height=10):
        
        file_io = BytesIO()
        image = Image.new('RGB', (width, height))
        image.save(file_io, ext)
        file_io.seek(0)
        return SimpleUploadedFile(name, file_io.read(), content_type=f'image/{ext}')

    def _create_pdf_file(self, name='test.pdf', valid=True):
        
        content = b'%PDF-1.4 sample content' if valid else b'this is not a pdf'
        return SimpleUploadedFile(name, content, content_type='application/pdf')

    def test_file_too_large_raises_error(self):

        large_file = self._create_image_file(size_kb=9 * 1024)
        item_image = ItemImage(item=self.item, image=large_file)
        with self.assertRaises(ValidationError):
            item_image.clean()

    def test_invalid_extension_raises_error(self):
        
        invalid_file = self._create_image_file(name='test.txt', content_type='text/plain')
        item_image = ItemImage(item=self.item, image=invalid_file)
        with self.assertRaises(ValidationError):
            item_image.clean()

    def test_valid_image_is_accepted(self):
        
        valid_image = self._create_real_image_file()
        item_image = ItemImage(item=self.item, image=valid_image)
        try:
            item_image.clean()
        except ValidationError:
            self.fail("Valid image should not raise ValidationError")

    def test_corrupt_image_raises_error(self):

        corrupt_file = self._create_image_file(name='corrupt.jpg')
        item_image = ItemImage(item=self.item, image=corrupt_file)
        with self.assertRaises(ValidationError):
            item_image.clean()

    def test_valid_pdf_is_accepted(self):
        
        valid_pdf = self._create_pdf_file()
        item_image = ItemImage(item=self.item, image=valid_pdf)
        try:
            item_image.clean()
        except ValidationError:
            self.fail("Valid PDF should not raise ValidationError")

    def test_invalid_pdf_raises_error(self):
        
        invalid_pdf = self._create_pdf_file(valid=False)
        item_image = ItemImage(item=self.item, image=invalid_pdf)
        with self.assertRaises(ValidationError):
            item_image.clean()

    @mock.patch('PIL.Image.open')
    def test_decompression_bomb_raises_error(self, mock_image_open):

        mock_img = mock.Mock()

        mock_img.width = 10000
        mock_img.height = 10000

        mock_image_open.return_value.__enter__.return_value = mock_img

        small_file = self._create_real_image_file(name='bomb.png', width=1, height=1)
        item_image = ItemImage(item=self.item, image=small_file)

        with self.assertRaises(ValidationError) as cm:
            item_image.clean()
        self.assertIn('Bild ist zu groß', str(cm.exception))
