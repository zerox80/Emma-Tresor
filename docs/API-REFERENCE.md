# Emma-Tresor API Reference Guide

## Overview

This comprehensive API reference provides complete documentation for all REST endpoints, data models, and client-side functions available in the Emma-Tresor inventory management system.

## Table of Contents

- [Authentication Endpoints](#authentication-endpoints)
- [Item Management](#item-management)
- [Tag Management](#tag-management)
- [Location Management](#location-management)
- [List Management](#list-management)
- [Image Management](#image-management)
- [Error Responses](#error-responses)
- [Rate Limiting](#rate-limiting)
- [Data Models](#data-models)
- [Client API](#client-api)

## Authentication Endpoints

### POST /api/auth/login/
Authenticates users and sets JWT cookies.

**Request Body:**
```json
{
  "username": "string",
  "email": "string (optional)",
  "password": "string",
  "remember": "boolean (optional)"
}
```

**Response (200 OK):**
```json
{
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com"
  },
  "access_expires": 900,
  "remember": false
}
```

**Response (401 Unauthorized):**
```json
{
  "detail": "Invalid credentials"
}
```

**Response (403 Forbidden):**
```json
{
  "detail": "Registration disabled"
}
```

### POST /api/auth/logout/
Logs out users and clears authentication cookies.

**Request Body:** Empty

**Response (204 No Content):** Empty response with cookies cleared

**Response (401 Unauthorized):** (if invalid token)
```json
{
  "detail": "Invalid session"
}
```

### POST /api/auth/refresh/
Refreshes JWT access tokens.

**Request Body:**
```json
{
  "refresh": "string (token or from cookie)"
}
```

**Response (200 OK):**
```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9c...",
  "access_expires": 900,
  "rotated": true
}
```

**Response (401 Unauthorized):**
```json
{
  "detail": "Refresh token invalid"
}
```

### GET /api/auth/user/
Returns current authenticated user information.

**Response (200 OK):**
```json
{
  "id": 1,
  "username": "johndoe",
  "email": "john@example.com"
}
```

**Response (401 Unauthorized):**
```json
{
  "detail": "Authentication required"
}
```

### GET /api/auth/csrf/
Sets CSRF cookie for unauthenticated users.

**Response (200 OK):**
```json
{
  "detail": "CSRF cookie set"
}
```

## Item Management

### GET /api/items/
Retrieves paginated list of items with filtering and search.

**Query Parameters:**
- `search` (string): Search items by name, description, tags, or location
- `page` (integer): Page number for pagination (default: 1)
- `page_size` (integer): Items per page (default: 20, max: 100)
- `tags` (string): Comma-separated tag IDs for filtering
- `location` (string): Comma-separated location IDs for filtering
- `ordering` (string): Sort field (prefix '-' for descending)

**Example:**
```bash
GET /api/items/?search=camera&tags=1,2&page=2&page_size=50
```

**Response (200 OK):**
```json
{
  "count": 150,
  "next": "http://localhost:8000/api/items/?page=3",
  "previous": "http://localhost:8000/api/items/?page=1",
  "results": [
    {
      "id": 1,
      "name": "Digital Camera",
      "description": "Canon EOS R5",
      "quantity": 1,
      "value": "599.99",
      "purchase_date": "2024-01-15",
      "asset_tag": "550e8400-e29b-41d4-a716-446655440b00000000",
      "created_at": "2024-01-10T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### POST /api/items/
Creates a new item.

**Request Body:**
```json
{
  "name": "string (required, max 255)",
  "description": "string (optional, max 10000)",
  "quantity": "integer (required, min 1, max 999999)",
  "purchase_date": "date (YYYY-MM-DD, optional)",
  "value": "decimal (optional, max 999999999.99)",
  "location": "integer (optional, existing location ID)",
  "wodis_inventory_number": "string (optional, max 120)",
  "tags": "array of integers (optional)"
}
```

**Response (201 Created):**
```json
{
  "id": 151,
  "name": "Digital Camera",
  "description": "Canon EOS R5",
  "quantity": 1,
  "value": "599.99",
  "purchase_date": "2024-01-15",
  "asset_tag": "550e8400-e29b-41d4-a716-446655440b00000000",
  "created_at": "2024-01-10T10:30:00Z",
  "updated_at": "2024-01-10T10:30:00Z",
  "location": null,
  "tags": [],
  "images": []
}
```

**Response (400 Bad Request):**
```json
{
  "name": ["This field is required."],
  "quantity": ["Must be at least 1."],
  "purchase_date": ["Date cannot be in future."],
  "value": ["Value cannot be negative."]
}
```

### GET /api/items/{id}/
Retrieves a specific item by ID.

**Response (200 OK):**
```json
{
  "id": 151,
  "name": "Digital Camera",
  "description": "Canon EOS R5",
  "quantity": 1,
  "value": "599.99",
  "purchase_date": "2024-01-15",
  "asset_tag": "550e8400-e29b-41d4-a716-446655440b00000000",
  "created_at": "2024-01-10T10:30:00Z",
  "updated_at": "2024-01-10T10:30:00Z",
  "location": {
    "id": 5,
    "name": "Office"
  },
  "tags": [
    {
      "id": 1,
      "name": "Electronics"
    }
  ],
  "images": [
    {
      "id": 42,
      "filename": "camera.jpg",
      "download_url": "/api/item-images/42/download/",
      "preview_url": "/api/item-images/42/"
    }
  ]
}
```

**Response (404 Not Found):**
```json
{
  "detail": "Item not found"
}
```

### PUT /api/items/{id}/
Updates an existing item.

**Request Body:** Same as POST /api/items/

**Response (200 OK):** Same structure as POST response

**Response (403 Forbidden):**
```json
{
  "detail": "This item does not belong to your account"
}
```

**Response (404 Not Found):**
```json
{
  "detail": "Item not found"
}
```

### DELETE /api/items/{id}/
Deletes an item.

**Response (204 No Content):** Empty response

**Response (403 Forbidden):**
```json
{
  "detail": "This item does not belong to your account"
}
```

**Response (404 Not Found):**
```json
{
  "detail": "Item not found"
}
```

### GET /api/items/lookup_by_tag/{asset_tag}/
Looks up item by UUID asset tag.

**URL Parameter:** `asset_tag` (UUID string)

**Response (200 OK):** Same as GET /api/items/{id}/

### GET /api/items/{id}/generate_qr_code/
Generates QR code for an item.

**Query Parameters:**
- `download` (boolean): Force download instead of inline display

**Response (200 OK):** PNG image data

**Headers:**
- `Content-Type`: image/png
- `Content-Disposition`: attachment; filename="item-151-qr.png"

### GET /api/items/{id}/changelog/
Retrieves change history for an item.

**Response (200 OK):**
```json
[
  {
    "id": 123,
    "item_name": "Digital Camera",
    "user_username": "johndoe",
    "action": "update",
    "action_display": "Aktualisierung",
    "changes": {
      "location_id": {
        "old": null,
        "new": 5
      },
      "description": {
        "old": "Old description",
        "new": "Updated description"
      }
    },
    "created_at": "2024-01-15T10:30:00Z",
    "user": 45
  }
]
```

## Tag Management

### GET /api/tags/
Retrieves all tags for the authenticated user.

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "name": "Electronics",
    "created_at": "2024-01-10T10:30:00Z",
    "updated_at": "2024-01-10T10:30:00Z"
  }
]
```

### POST /api/tags/
Creates a new tag.

**Request Body:**
```json
{
  "name": "string (required, max 100)"
}
```

**Response (201 Created):**
```json
{
  "id": 25,
  "name": "Electronics",
  "created_at": "2024-01-10T10:30:00Z",
  "updated_at": "2024-01-10T10:30:00Z"
}
```

**Response (400 Bad Request):**
```json
{
  "name": ["A tag with this name already exists."]
}
```

### DELETE /api/tags/{id}/
Deletes a tag.

**Response (204 No Content):** Empty response

**Response (404 Not Found):**
```json
{
  "detail": "Tag not found"
}
```

## Location Management

Same API patterns as Tag Management with `/locations/` endpoint.

## List Management

### GET /api/lists/
Retrieves all item lists for the authenticated user.

### POST /api/lists/
Creates a new item list.

**Request Body:**
```json
{
  "name": "string (required, max 255)"
}
```

### GET /api/lists/{id}/export/
Exports all items in a list as CSV.

**Response:** CSV file download with headers:
```
ID,Name,Beschreibung,Anzahl,Standort,Tags,Listen,Inventarnummer,Kaufdatum,Wert (EUR),Asset-Tag,Erstellt am,Aktualisiert am
1,Camera Kit,Complete photo setup,3,Office,1,2,CK-001,2024-01-01,550e8400-e29b-41d4-a716-446655440b00000000,2024-01-10T10:30:00Z
```

## Image Management

### GET /api/item-images/
Retrieves all images for the authenticated user's items.

**Response (200 OK):**
```json
[
  {
    "id": 42,
    "item": 151,
    "filename": "camera.jpg",
    "download_url": "/api/item-images/42/download/",
    "preview_url": "/api/item-images/42/",
    "content_type": "image/jpeg",
    "size": 2048576,
    "created_at": "2024-01-10T10:30:00Z"
  }
]
```

### POST /api/item-images/
Uploads an image for an item.

**Request Body:** `multipart/form-data`
- `item`: integer (required) - Item ID
- `image`: file (required) - Image file

**Response (201 Created):**
```json
{
  "id": 43,
  "item": 151,
  "filename": "camera.jpg",
  "download_url": "/api/item-images/43/download/",
  "preview_url": "/api/item-images/43/",
  "content_type": "image/jpeg",
  "size": 2048576,
  "created_at": "2024-01-10T10:30:00Z"
}
```

### GET /api/item-images/{id}/download/
Downloads an image file.

**Response:** File data with appropriate headers:
- `Content-Type`: Based on file type
- `Content-Disposition`: attachment; filename="original-filename.ext"
- `Cache-Control`: private, max-age=0

## Rate Limiting

All endpoints implement comprehensive rate limiting:

| Endpoint | Scope | Rate Limit | Purpose |
|----------|------|-----------|---------|
| Login | `login` | 5/hour | Prevent brute force attacks |
| Registration | `register` | 5/hour | Prevent spam accounts |
| Item Operations | `item_*` | 100/hour | Prevent bulk operations |
| QR Generation | `qr_generate` | 20/hour | Prevent resource abuse |
| Image Download | `image_download` | 60/hour | Prevent bandwidth abuse |
| Export Operations | `item_export` | 10/hour | Prevent data scraping |

## Data Models

### Item
```python
class Item(TimeStampedModel):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    quantity = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1), MaxValueValidator(999999)])
    purchase_date = models.DateField(blank=True, null=True)
    value = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    asset_tag = models.UUIDField(default=uuid.uuid4, editable=False, unique=True, db_index=True)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='items')
    location = models.ForeignKey('Location', on_delete=models.SET_NULL, null=True, blank=True, related_name='items')
    wodis_inventory_number = models.CharField(max_length=120, blank=True, null=True, db_index=True)
    tags = models.ManyToManyField('Tag', related_name='items', blank=True)
    images = models.ManyToManyField('ItemImage', related_name='images', blank=True)
```

### User
```python
class User(AbstractUser):
    username = models.CharField(max_length=150)
    email = models.EmailField(unique=True)
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
```

## Client API

### Authentication Client

```typescript
// Login
const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  const response = await apiClient.post('/auth/login/', credentials);
  // Cookies are automatically set by the server
  return response.data;
};

// Logout
const logout = async (): Promise<void> => {
  await apiClient.post('/auth/logout/');
  // Cookies are automatically cleared by the server
};

// Get current user
const getCurrentUser = async (): Promise<User | null> => {
  const response = await apiClient.get('/auth/user/');
  return response.data;
};
```

### Item Management Client

```typescript
// Fetch items with filters
const fetchItems = async (options: FetchItemsOptions): Promise<PaginatedResponse<Item>> => {
  const params = new URLSearchParams();
  
  if (options.search) params.set('search', options.search);
  if (options.page) params.set('page', options.page.toString());
  if (options.pageSize) params.set('page_size', options.pageSize.toString());
  if (options.tags?.length) params.set('tags', options.tags.join(','));
  if (options.locations?.length) params.set('location', options.locations.join(','));
  if (options.ordering) params.set('ordering', options.ordering);
  
  const response = await apiClient.get(`/items/?${params.toString()}`);
  return response.data;
};

// Create item
const createItem = async (itemData: ItemPayload): Promise<Item> => {
  const response = await apiClient.post('/items/', itemData);
  return response.data;
};

// Update item
const updateItem = async (id: number, itemData: ItemPayload): Promise<Item> => {
  const response = await apiClient.put(`/items/${id}/`, itemData);
  return response.data;
};

// Delete item
const deleteItem = async (id: number): Promise<void> => {
  await apiClient.delete(`/items/${id}/`);
};
```

This API reference provides complete documentation for all endpoints, request/response formats, rate limiting, and client usage patterns. It serves as the definitive guide for integrating with Emma-Tresor's REST API.
