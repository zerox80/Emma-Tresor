# Emma-Tresor Developer Guide

## Overview

This comprehensive guide provides developers with the knowledge needed to effectively work with and extend the Emma-Tresor inventory management system. It covers architecture patterns, best practices, security considerations, and common development workflows.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Development Setup](#development-setup)
- [Code Standards & Patterns](#code-standards--patterns)
- [Security Guidelines](#security-guidelines)
- [API Development](#api-development)
- [Frontend Development](#frontend-development)
- [Testing Guidelines](#testing-guidelines)
- [Performance Optimization](#performance-optimization)
- [Troubleshooting](#troubleshooting)
- [Common Patterns](#common-patterns)

## Architecture Overview

### Backend Architecture (Django/DRF)

```
┌─────────────────────────────────────────────────────────────┐
│                 Django Application Layer              │
├─────────────────────────────────────────────────────────────┤
│  EmmaTresor/          │  inventory/              │
│  ├── settings.py        │  ├── models.py          │
│  ├── urls.py           │  ├── views.py           │
│  ├── middleware.py      │  ├── serializers.py     │
│  └── wsgi.py          │  └── urls.py           │
└─────────────────────────────────────────────────────────────┘
```

**Key Components:**
- **Models**: Data layer with comprehensive validation and security
- **Views**: REST API endpoints with rate limiting and authentication
- **Serializers**: Data validation and transformation with XSS protection
- **Middleware**: CSRF handling and security headers

### Frontend Architecture (React/TypeScript)

```
┌─────────────────────────────────────────────────────────────┐
│                React Application Layer               │
├─────────────────────────────────────────────────────────────┤
│  src/                                            │
│  ├── components/     │  ├── hooks/             │
│  ├── pages/          │  ├── store/             │
│  ├── api/            │  ├── types/             │
│  └── utils/          │  └── routes/            │
└─────────────────────────────────────────────────────────────┘
```

**Key Components:**
- **Components**: Reusable UI components with comprehensive JSDoc
- **Hooks**: Custom React hooks for state management and API calls
- **Store**: Zustand-based state management with persistence
- **API**: Centralized HTTP client with interceptors

## Development Setup

### Prerequisites
- Python 3.12+
- Node.js 20+
- Docker (optional)

### Backend Setup
```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# or
.venv\Scripts\Activate.ps1  # Windows

# Install dependencies
pip install -r backend/requirements.txt

# Run migrations
python backend/manage.py migrate

# Create superuser
python backend/manage.py createsuperuser

# Start development server
python backend/manage.py runserver
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev  # Development server
npm run build  # Production build
npm run typecheck  # Type checking
```

## Code Standards & Patterns

### Backend Documentation Standards

All public functions, classes, and methods must include Google-style docstrings:

```python
def example_function(param1: str, param2: int) -> bool:
    """Example function with comprehensive documentation.
    
    This function demonstrates the expected documentation format for
    all public API functions in the Emma-Tresor codebase.
    
    Args:
        param1: A string parameter representing the user input.
        param2: An integer parameter for configuration.
        
    Returns:
        bool: True if operation succeeds, False otherwise.
        
    Raises:
        ValidationError: If param1 is empty or param2 is negative.
        PermissionDenied: If user lacks required permissions.
        
    Example:
        >>> result = example_function("test", 5)
        >>> print(result)
        True
        
    Security:
        - Input validation prevents injection attacks
        - Parameter sanitization ensures data integrity
        - Rate limiting applies to prevent abuse
    """
    # Implementation here
    pass
```

### Frontend Documentation Standards

All components, hooks, and interfaces must include JSDoc:

```typescript
/**
 * Component description explaining purpose and behavior.
 * 
 * @example
 * ```tsx
 * <ExampleComponent 
 *   isActive={true}
 *   onAction={(result) => console.log(result)}
 * />
 * ```
 * 
 * @security
 * - Props are validated with Zod schemas
 * - XSS protection through content sanitization
 * - CSRF tokens included in API requests
 */
interface ExampleComponentProps {
  /** Whether the component is in active state */
  isActive: boolean;
  /** Callback function triggered when user performs action */
  onAction: (result: ActionResult) => void;
}

/**
 * Custom hook example with comprehensive documentation.
 * 
 * @returns Hook state object containing:
 * - `data`: Current state data
 * - `loading`: Loading state indicator
 * - `error`: Error information if any
 * - `actions`: Object containing action functions
 */
export const useExampleHook = () => {
  // Implementation here
};
```

## Security Guidelines

### Authentication & Authorization

1. **JWT Token Management**
   ```python
   # Always use secure cookie settings
   response.set_cookie(
       settings.JWT_ACCESS_COOKIE_NAME,
       token,
       httponly=settings.JWT_COOKIE_HTTPONLY,
       secure=settings.JWT_COOKIE_SECURE,
       samesite=settings.JWT_COOKIE_SAMESITE,
   )
   ```

2. **User Scoping**
   ```python
   def get_queryset(self):
       """Always filter by current user for data isolation."""
       queryset = super().get_queryset()
       if not self.request.user.is_authenticated:
           return queryset.none()
       return queryset.filter(user=self.request.user)
   ```

3. **Input Validation**
   ```python
   def validate_image(self, value):
       """Comprehensive file validation with security checks."""
       # Content-Type validation
       allowed_types = {'image/jpeg', 'image/png', 'application/pdf'}
       if value.content_type not in allowed_types:
           raise serializers.ValidationError('Invalid file type')
       
       # Extension validation
       allowed_extensions = {'.jpg', '.png', '.pdf'}
       ext = os.path.splitext(value.name)[1].lower()
       if ext not in allowed_extensions:
           raise serializers.ValidationError('Invalid extension')
           
       # Cross-validation prevents MIME confusion attacks
       expected_exts = content_to_ext.get(value.content_type, set())
       if ext not in expected_exts:
           raise serializers.ValidationError('File extension mismatch')
   ```

### Frontend Security

1. **XSS Prevention**
   ```typescript
   // Always sanitize HTML content
   const cleanDescription = bleach.clean(
     userInput,
     { tags: ['p', 'br', 'strong'], strip: true }
   );
   ```

2. **Type Safety**
   ```typescript
   // Use Zod for runtime validation
   const schema = z.object({
     name: z.string().min(1).max(255),
     email: z.string().email(),
   });
   
   const validated = schema.parse(userInput);
   ```

## API Development

### REST Endpoint Patterns

All API endpoints follow consistent patterns:

```python
class ExampleViewSet(viewsets.ModelViewSet):
    """Standard viewset with comprehensive security and documentation."""
    
    # Authentication and permissions
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ExampleRateThrottle]
    
    def get_queryset(self):
        """User-scoped queryset for data isolation."""
        return ExampleModel.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        """Automatically set user ownership."""
        serializer.save(user=self.request.user)
    
    @action(detail=True, methods=['post'])
    def custom_action(self, request, pk=None):
        """Custom action with proper error handling."""
        try:
            # Implementation here
            return Response({'status': 'success'})
        except ValidationError as e:
            return Response(
                {'detail': str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )
```

### Rate Limiting

Implement rate limiting for all user actions:

```python
class ExampleRateThrottle(throttling.UserRateThrottle):
    """Rate limiting for sensitive operations."""
    scope = 'example_action'  # Defined in settings
```

Settings configuration:
```python
REST_FRAMEWORK = {
    'DEFAULT_THROTTLE_RATES': {
        'example_action': '10/hour',
        'user_registration': '5/hour',
    }
}
```

## Frontend Development

### Component Patterns

#### Form Components
```typescript
interface FormComponentProps {
  /** Initial form data */
  initialData?: FormData;
  /** Submit handler with validated data */
  onSubmit: (data: ValidatedData) => Promise<void>;
  /** Optional cancel handler */
  onCancel?: () => void;
}

/**
 * Standardized form component with validation and error handling.
 * 
 * Uses react-hook-form with Zod validation for type safety.
 * Provides consistent UX across all forms in the application.
 */
const FormComponent: React.FC<FormComponentProps> = ({
  initialData,
  onSubmit,
  onCancel,
}) => {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData,
  });

  // Implementation with comprehensive error handling
};
```

#### API Hooks
```typescript
/**
 * Custom hook for API operations with loading states.
 * 
 * Provides consistent error handling and loading indicators
 * across all API interactions in the application.
 * 
 * @param endpoint - API endpoint to call
 * @param options - Configuration options
 * @returns Object containing:
 * - `data`: Response data or null
 * - `loading`: Boolean loading state
 * - `error`: Error message or null
 * - `execute`: Function to trigger API call
 */
export const useApiCall = <T, P>(
  endpoint: string, 
  options?: ApiOptions<P>
) => {
  // Implementation with proper error boundaries
};
```

### State Management

Use Zustand for predictable state management:

```typescript
interface AppState {
  /** Current authentication state */
  isAuthenticated: boolean;
  /** User profile information */
  user: User | null;
  /** Global loading states */
  loading: Record<string, boolean>;
  /** Error states */
  errors: Record<string, string | null>;
}

export const useAppStore = create<AppState>((set, get) => ({
  isAuthenticated: false,
  user: null,
  loading: {},
  errors: {},
  
  // Actions with proper typing
  login: async (credentials) => {
    set({ loading: { ...get().loading, login: true } });
    try {
      const user = await api.login(credentials);
      set({ isAuthenticated: true, user });
    } catch (error) {
      set({ errors: { ...get().errors, login: error.message }});
    } finally {
      set({ loading: { ...get().loading, login: false }});
    }
  },
}));
```

## Testing Guidelines

### Backend Testing

```python
class TestExample(TestCase):
    """Standard test class with comprehensive coverage."""
    
    def setUp(self):
        """Set up test environment with required data."""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
    
    def test_valid_operation(self):
        """Test successful operation with expected output."""
        # Arrange
        test_data = {'name': 'Test Item'}
        
        # Act
        response = self.client.post('/api/items/', test_data)
        
        # Assert
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Item.objects.count(), 1)
        
    def test_invalid_operation(self):
        """Test error handling for invalid input."""
        # Test validation errors, permissions, etc.
        pass
```

### Frontend Testing

```typescript
describe('Component Example', () => {
  const defaultProps = {
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with default props', () => {
    render(<ComponentExample {...defaultProps} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('handles user interactions properly', async () => {
    const onSubmit = vi.fn();
    render(<ComponentExample {...defaultProps} onSubmit={onSubmit} />);
    
    await userEvent.click(screen.getByText('Submit'));
    expect(onSubmit).toHaveBeenCalledWith(expectedData);
  });

  it('displays error messages appropriately', () => {
    render(<ComponentExample {...defaultProps} error="Test error" />);
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });
});
```

## Performance Optimization

### Backend Optimization

1. **Database Queries**
   ```python
   # Use select_related and prefetch_related
   items = Item.objects.filter(user=user)\
       .select_related('location', 'owner')\
       .prefetch_related('tags', 'images')\
       .distinct()
   ```

2. **Caching**
   ```python
   from django.core.cache import cache
   
   def expensive_operation(param):
       cache_key = f'expensive_op_{param}'
       result = cache.get(cache_key)
       if result is None:
           result = perform_expensive_calculation(param)
           cache.set(cache_key, result, timeout=300)
       return result
   ```

3. **Pagination**
   ```python
   class StandardPagination(PageNumberPagination):
       page_size = 20
       page_size_query_param = 'page_size'
       max_page_size = 100
   ```

### Frontend Optimization

1. **Memoization**
   ```typescript
   // Use React.memo for expensive components
   const ExpensiveComponent = React.memo(({ data }) => {
     // Component implementation
   }, (prevProps, nextProps) => {
     // Custom comparison for optimization
     return prevProps.data.id === nextProps.data.id;
   });
   ```

2. **Debouncing**
   ```typescript
   import { useDebouncedValue } from './hooks/useDebouncedValue';
   
   const Component = () => {
     const [searchTerm, setSearchTerm] = useState('');
     const debouncedSearch = useDebouncedValue(searchTerm, 300);
     
     useEffect(() => {
       // Only trigger search when debounced value changes
       performSearch(debouncedSearch);
     }, [debouncedSearch]);
   };
   ```

3. **Code Splitting**
   ```typescript
   // Lazy load components for better initial load
   const HeavyComponent = lazy(() => import('./HeavyComponent'));
   
   const App = () => (
     <Suspense fallback={<Loading />}>
       <HeavyComponent />
     </Suspense>
   );
   ```

## Troubleshooting

### Common Issues and Solutions

#### Backend Issues

1. **Database Migration Errors**
   ```bash
   # Reset migrations (development only)
   python backend/manage.py migrate --fake-initial
   python backend/manage.py migrate --fake
   ```

2. **Permission Denied Errors**
   ```python
   # Check user authentication and permissions
   print(request.user.is_authenticated)
   print(request.user.has_perm('app.view_model'))
   ```

3. **Performance Issues**
   ```python
   # Enable Django debug toolbar
   pip install django-debug-toolbar
   # Add to INSTALLED_APPS and MIDDLEWARE
   ```

#### Frontend Issues

1. **TypeScript Compilation Errors**
   ```bash
   # Clear cache and reinstall
   rm -rf node_modules package-lock.json
   npm install
   npm run typecheck
   ```

2. **State Management Issues**
   ```typescript
   // Debug Zustand state
   console.log(useAppStore.getState());
   
   // Subscribe to state changes
   useAppStore.subscribe((state) => console.log(state));
   ```

3. **API Connection Issues**
   ```typescript
   // Check network requests in browser dev tools
   // Verify API base URL configuration
   console.log(import.meta.env.VITE_API_BASE_URL);
   ```

### Debugging Techniques

1. **Backend Logging**
   ```python
   import logging
   logger = logging.getLogger(__name__)
   
   def problematic_function():
       logger.info(f"Starting function with params: {params}")
       try:
           result = risky_operation()
           logger.info(f"Operation completed successfully")
           return result
       except Exception as e:
           logger.error(f"Operation failed: {e}", exc_info=True)
           raise
   ```

2. **Frontend Debugging**
   ```typescript
   // Use React DevTools Profiler
   <React.Profiler id="Component" onRender={(id, phase, actualDuration) => {
     console.log(`${id} ${phase} took ${actualDuration}ms`);
   }}>
     <Component />
   </React.Profiler>
   ```

## Common Patterns

### Error Handling Patterns

#### Backend
```python
from rest_framework.response import Response
from rest_framework import status

def api_view_example(request):
    """Standardized error handling pattern."""
    try:
        # Validate input
        if not request.data.get('required_field'):
            return Response(
                {'detail': 'Required field missing'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Perform operation
        result = perform_operation(request.data)
        
        return Response({
            'status': 'success',
            'data': result
        })
        
    except ValidationError as e:
        return Response(
            {'detail': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )
    except PermissionDenied as e:
        return Response(
            {'detail': 'Permission denied'},
            status=status.HTTP_403_FORBIDDEN
        )
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        return Response(
            {'detail': 'Internal server error'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
```

#### Frontend
```typescript
// Consistent error handling with user feedback
const useApiOperation = () => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const execute = useCallback(async (operation: () => Promise<any>) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await operation();
      return result;
    } catch (err) {
      const message = err.response?.data?.detail || err.message || 'An error occurred';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);
  
  return { execute, loading, error };
};
```

### Data Validation Patterns

#### Backend
```python
from django.core.exceptions import ValidationError

class ItemSerializer(serializers.ModelSerializer):
    def validate_name(self, value):
        """Comprehensive field validation."""
        if not value or not value.strip():
            raise ValidationError('Name is required')
        
        if len(value) > 255:
            raise ValidationError('Name too long')
            
        # Additional business logic validation
        if Item.objects.filter(name__iexact=value.strip()).exists():
            raise ValidationError('Item with this name already exists')
            
        return value.strip()
    
    def validate(self, attrs):
        """Cross-field validation."""
        if attrs.get('purchase_date') and attrs.get('purchase_date') > date.today():
            raise ValidationError('Purchase date cannot be in future')
        return attrs
```

#### Frontend
```typescript
import { z } from 'zod';

const itemSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(255, 'Name too long'),
  quantity: z.number()
    .int('Must be whole number')
    .min(1, 'Must be at least 1'),
  purchaseDate: z.string()
    .optional()
    .refine(
      (date) => !date || /^\d{4}-\d{2}-\d{2}$/.test(date),
      'Invalid date format'
    )
});

type ItemForm = z.infer<typeof itemSchema>;

// Use with react-hook-form for automatic validation
const form = useForm<ItemForm>({
  resolver: zodResolver(itemSchema)
});
```

This guide provides the foundation for effective development with Emma-Tresor. Follow these patterns to maintain code quality, security, and performance standards.
