# Emma-Tresor Troubleshooting Guide

## Overview

This comprehensive troubleshooting guide helps developers diagnose and resolve common issues that may arise during development, deployment, or maintenance of the Emma-Tresor inventory management system.

## Table of Contents

- [Development Issues](#development-issues)
- [Backend Problems](#backend-problems)
- [Frontend Problems](#frontend-problems)
- [Database Issues](#database-issues)
- [API Problems](#api-problems)
- [Authentication Issues](#authentication-issues)
- [Performance Issues](#performance-issues)
- [Deployment Issues](#deployment-issues)
- [Debugging Techniques](#debugging-techniques)
- [Common Error Messages](#common-error-messages)

## Development Issues

### Environment Setup Problems

#### Issue: Python Virtual Environment Not Working
```bash
# Symptoms
Error: Python command not found
Error: ModuleNotFoundError: No module named 'django'

# Solutions
# 1. Recreate virtual environment
python -m venv .venv --clear

# 2. Activate properly
# Windows
.venv\Scripts\Activate.ps1
# Linux/Mac
source .venv/bin/activate

# 3. Verify activation
which python  # Should point to .venv/bin/python
python --version  # Should show correct version
```

#### Issue: Node.js Dependencies Not Installing
```bash
# Symptoms
npm ERR! code ERESOLVE
npm ERR! errno ERESOLVE
npm ERR! Error: Cannot resolve dependency tree

# Solutions
# 1. Clear npm cache
npm cache clean --force

# 2. Delete node_modules and package-lock
rm -rf node_modules package-lock.json

# 3. Reinstall dependencies
npm install

# 4. Use specific Node version
# Ensure using Node.js 20+ as specified in requirements
node --version
```

#### Issue: Docker Build Failures
```bash
# Symptoms
ERROR: Service 'backend' failed to build
ERROR: Cannot connect to the Docker daemon

# Solutions
# 1. Check Docker daemon
docker --version
docker info

# 2. Clean build cache
docker compose down
docker system prune -f

# 3. Rebuild with no cache
docker compose build --no-cache

# 4. Check resource limits
docker stats
# Increase memory if needed in docker-compose.yml
```

## Backend Problems

### Django Management Command Issues

#### Issue: Migration Errors
```python
# Symptoms
django.db.migrations.exceptions.NodeNotFoundError
django.core.management.base.CommandError: Conflicting migrations detected

# Solutions
# 1. Check migration status
python manage.py showmigrations --plan

# 2. Fake initial migration (development only)
python manage.py migrate --fake-initial

# 3. Apply specific migration
python manage.py migrate app_name migration_number

# 4. Reset migrations (last resort)
python manage.py migrate app_name zero
```

#### Issue: Static Files Not Loading
```python
# Symptoms
404 Not Found for /static/ files
TemplateSyntaxError: static files not found

# Solutions
# 1. Check STATIC_URLS in settings.py
STATIC_URLS = [
    '/static/',
]

# 2. Verify STATIC_ROOT configuration
STATIC_ROOT = BASE_DIR / 'staticfiles'

# 3. Collect static files
python manage.py collectstatic --no-input

# 4. Check nginx/static file serving
# Ensure nginx serves static files in production
```

#### Issue: Database Connection Problems
```python
# Symptoms
django.db.utils.OperationalError
connection refused
timeout errors

# Solutions
# 1. Check database configuration
# Verify DB_VENDOR in .env
# Check connection parameters
echo $DB_HOST $DB_PORT $DB_NAME $DB_USER

# 2. Test connection manually
python manage.py dbshell
# Or use psql/mysql client directly

# 3. Check network connectivity
telnet $DB_HOST $DB_PORT
nc -zv $DB_HOST $DB_PORT

# 4. Restart database service
sudo systemctl restart postgresql  # or mysql
```

### Performance Issues

#### Issue: Slow Database Queries
```python
# Symptoms
Page load times > 5 seconds
Memory usage increasing
High CPU usage on database

# Solutions
# 1. Enable Django debug toolbar
pip install django-debug-toolbar
# Add to INSTALLED_APPS and MIDDLEWARE

# 2. Use select_related and prefetch_related
items = Item.objects.filter(user=user)\
    .select_related('location', 'owner')\
    .prefetch_related('tags', 'images')\
    .distinct()

# 3. Add database indexes
# Add indexes for frequently queried fields
class Meta:
    indexes = [
        models.Index(fields=['owner', 'created_at']),
        models.Index(fields=['name']),
    ]

# 4. Use pagination for large datasets
class StandardPagination(PageNumberPagination):
    page_size = 20
    max_page_size = 100
```

#### Issue: Memory Leaks
```python
# Symptoms
Memory usage increases over time
Server crashes randomly
Slow response times

# Solutions
# 1. Check for unclosed database connections
from django.db import connection
connections = connection.all_connections
print(f"Active connections: {len(connections)}")

# 2. Monitor with memory profiler
pip install memory-profiler
python -m memory_profiler manage.py runserver

# 3. Check for large object caching
from django.core.cache import cache
cache_info = cache._cache.info()
print(f"Cache info: {cache_info}")
```

## Frontend Problems

### React Component Issues

#### Issue: Component Not Rendering
```typescript
// Symptoms
Component shows blank screen
Console errors: "Component not found"
TypeScript compilation errors

// Solutions
// 1. Check component import paths
import Component from './components/Component'  // Verify path
import Component from '../components/Component'  // Relative path

// 2. Verify component export
export default ComponentName;
export { ComponentName };  // Named export

// 3. Check React DevTools
// Open browser dev tools, check Components tab
// Verify component is mounting/unmounting correctly

// 4. Check TypeScript configuration
// Ensure tsconfig.json paths are correct
npm run typecheck  // Run type checking
```

#### Issue: State Management Problems
```typescript
// Symptoms
State not updating between components
Inconsistent data display
Race conditions in API calls

// Solutions
// 1. Debug Zustand store
import { useAppStore } from '../store/authStore';

// Add debug logging
console.log('Current state:', useAppStore.getState());

// Subscribe to state changes
useAppStore.subscribe((state) => {
  console.log('State changed:', state);
});

// 2. Check store initialization
// Ensure store is properly initialized in App.tsx
const App = () => {
  // Store initialization should happen here
};

// 3. Verify selector usage
// Use selectors correctly
const user = useAppStore(state => state.user);
```

#### Issue: API Integration Problems
```typescript
// Symptoms
Network errors: 401, 403, 500
CORS errors in browser console
Request timeouts

// Solutions
// 1. Check API base URL
console.log(import.meta.env.VITE_API_BASE_URL);
// Should match Django settings

// 2. Verify authentication headers
// Check if JWT cookies are being sent
// In browser dev tools -> Network tab -> Headers

// 3. Debug API client
// Add logging to axios interceptors
apiClient.interceptors.request.use(config => {
  console.log('Request:', config);
  return config;
});

apiClient.interceptors.response.use(
  response => {
    console.log('Response:', response);
    return response;
  },
  error => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);
```

### Build and Bundle Issues

#### Issue: TypeScript Compilation Errors
```bash
# Symptoms
npm run typecheck fails
Cannot find module errors
Type 'X' has no properties in common with type 'Y'

# Solutions
# 1. Clean build artifacts
rm -rf dist node_modules .vite

# 2. Clear TypeScript cache
npx tsc --build --clean

# 3. Reinstall type definitions
npm install @types/react @types/react-dom

# 4. Check tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

#### Issue: Vite Development Server Problems
```bash
# Symptoms
Vite server not starting
HMR (Hot Module Replacement) not working
Port already in use

# Solutions
# 1. Check port availability
netstat -tulpn | grep :5173
lsof -i :5173

# 2. Clear Vite cache
rm -rf node_modules/.vite

# 3. Restart with specific port
npm run dev -- --port 3001

# 4. Check firewall settings
# Ensure port 5173 is not blocked
```

## Database Issues

### PostgreSQL Problems

#### Issue: Connection Timeouts
```sql
-- Symptoms
connection timed out
could not connect to server
FATAL: database "dbname" does not exist

-- Solutions
-- 1. Check PostgreSQL service status
sudo systemctl status postgresql

-- 2. Verify configuration
sudo -u postgres psql -c "show config_file;"

-- 3. Check network connectivity
telnet localhost 5432

-- 4. Review connection limits
-- Check max_connections in postgresql.conf
```

#### Issue: Query Performance
```sql
-- Symptoms
Slow query execution
High CPU usage
Large memory consumption

-- Solutions
-- 1. Analyze with EXPLAIN
EXPLAIN ANALYZE SELECT * FROM inventory_item;

-- 2. Add appropriate indexes
CREATE INDEX CONCURRENTLY idx_item_owner_created 
ON inventory_item (owner_id, created_at);

-- 3. Optimize queries
-- Use JOINs instead of subqueries
-- Avoid N+1 problems

-- 4. Check for table bloat
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)),
       pg_total_relation_size(schemaname||'.'||tablename) AS size
FROM pg_class c
LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## API Problems

### Django REST Framework Issues

#### Issue: Serialization Errors
```python
# Symptoms
AttributeError: Got AttributeError when attempting to get a field
Object of type 'ListSerializer' has no attribute 'data'

# Solutions
# 1. Check serializer context
# Ensure request is passed to serializer
serializer = ItemSerializer(data=data, context={'request': request})

# 2. Verify field names
# Check if field names match model fields
# Use serializer.errors to see validation issues

# 3. Handle nested data properly
# Use many=True for nested relationships
tags = serializers.PrimaryKeyRelatedField(many=True, queryset=Tag.objects.all())

# 4. Check read-only fields
# Ensure read_only_fields are properly set
```

#### Issue: Permission Errors
```python
# Symptoms
403 Forbidden responses
PermissionDenied exceptions
CSRF token missing or incorrect

# Solutions
# 1. Check authentication middleware
# Ensure authentication is applied before permission checks

# 2. Verify CSRF configuration
# Check CSRF_COOKIE_SECURE settings
# Ensure CSRF middleware is enabled

# 3. Check permission classes
permission_classes = [permissions.IsAuthenticated]
# Custom permissions should inherit from BasePermission

# 4. Debug with request user
print(request.user.is_authenticated)
print(request.user.permissions)
```

### Rate Limiting Issues

#### Issue: API Endpoints Being Throttled
```python
# Symptoms
429 Too Many Requests
Request was throttled
Rate limit exceeded

# Solutions
# 1. Check throttle configuration
REST_FRAMEWORK = {
    'DEFAULT_THROTTLE_RATES': {
        'user_action': '100/hour',
        'anon_action': '10/hour',
    }
}

# 2. Implement exponential backoff
# In frontend API client
const retryRequest = async (fn, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.response?.status === 429) {
        const delay = Math.pow(2, i) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
};

# 3. Use cache for rate limiting
from django.core.cache import cache

@cache_page(60 * 15)  # 15 minutes
def expensive_api_view(request):
  # Implementation here
```

## Authentication Issues

### JWT Token Problems

#### Issue: Token Not Validating
```python
# Symptoms
Token is invalid or expired
401 Unauthorized responses
CSRF token missing

# Solutions
# 1. Check JWT settings
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
}

# 2. Verify token format
# Use jwt.decode to check token structure
import jwt
try:
    decoded = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
except jwt.ExpiredSignatureError:
    # Token expired
except jwt.InvalidTokenError:
    # Token invalid

# 3. Check cookie configuration
JWT_COOKIE_HTTPONLY = True
JWT_COOKIE_SECURE = True  # Should be False in development
JWT_COOKIE_SAMESITE = 'Lax'
```

#### Issue: Session Management
```python
# Symptoms
User logged out unexpectedly
Session data lost
Multiple authentication states

# Solutions
# 1. Check session configuration
SESSION_ENGINE = 'django.contrib.sessions.backends.db'
SESSION_COOKIE_AGE = 1209600  # 2 weeks

# 2. Verify middleware order
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    # ... other middleware
]

# 3. Debug session storage
# Check if session data is being saved properly
from django.contrib.sessions.backends.db import SessionStore
sessions = SessionStore()
print(sessions.load(session_key))
```

## Performance Issues

### Frontend Optimization

#### Issue: Slow Initial Load
```typescript
// Symptoms
First Contentful Paint > 3 seconds
Large JavaScript bundles
Slow API initial requests

// Solutions
// 1. Implement code splitting
const HeavyComponent = lazy(() => import('./HeavyComponent'));

// 2. Optimize bundle size
// In vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          components: ['./src/components/index.js'],
        },
      },
    },
  },
});

// 3. Add service worker for caching
// Register service worker for offline capability

// 4. Use React.memo appropriately
const OptimizedComponent = React.memo(Component, (prev, next) => {
  return prev.id === next.id; // Custom comparison
});
```

#### Issue: Memory Leaks in Browser
```typescript
// Symptoms
Memory usage increases over time
Tab crashes
Slow garbage collection

// Solutions
// 1. Clean up event listeners
useEffect(() => {
  const handler = () => console.log('cleanup');
  window.addEventListener('resize', handler);
  
  return () => {
    window.removeEventListener('resize', handler);
  };
}, []);

// 2. Clear intervals and timeouts
useEffect(() => {
  const interval = setInterval(() => {
    // Update logic
  }, 1000);
  
  return () => {
    clearInterval(interval);
  };
}, []);

// 3. Dispose resources
// Clear object URLs
useEffect(() => {
  return () => {
    filePreviews.forEach(preview => {
      if (preview.url.startsWith('blob:')) {
        URL.revokeObjectURL(preview.url);
      }
    });
  };
}, [filePreviews]);

// 4. Monitor with Performance API
// In browser dev tools
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log(`${entry.name}: ${entry.duration}ms`);
  }
});
observer.observe({entryTypes: ['measure']});
```

### Backend Optimization

#### Issue: High Memory Usage
```python
# Symptoms
Memory usage increases continuously
Out of memory errors
Slow garbage collection

# Solutions
# 1. Monitor Django memory usage
import tracemalloc

tracemalloc.start()
# ... run application
snapshot = tracemalloc.take_snapshot()
top_stats = snapshot.statistics('lineno')
print(top_stats[:10])  # Top 10 memory allocations

# 2. Optimize queryset evaluation
# Use iterator() for large datasets
for item in Item.objects.filter(user=user).iterator():
    process_item(item)

# 3. Implement connection pooling
# In settings.py
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'OPTIONS': {
            'MAX_CONNS': 20,
            'CONN_MAX_AGE': 600,
        },
    },
}

# 4. Use Django's caching framework
from django.views.decorators.cache import cache_page

@cache_page(60 * 15)  # 15 minutes
def expensive_view(request):
    # Implementation here
```

## Deployment Issues

### Production Environment Problems

#### Issue: Static Files Not Serving
```nginx
# Symptoms
404 errors for static files
CSS/JS not loading
Incorrect content types

# Solutions
# 1. Check nginx configuration
location /static/ {
    alias /var/www/emmatresor/static/;
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# 2. Verify collected static files
# Run collectstatic in production
python manage.py collectstatic --no-input --clear

# 3. Check file permissions
# Ensure web server can read static files
ls -la /var/www/emmatresor/static/

# 4. Debug with curl
curl -I http://domain.com/static/css/main.css
```

#### Issue: Database Connection in Production
```bash
# Symptoms
Connection refused
Database not accessible
Authentication failures

# Solutions
# 1. Check PostgreSQL service
sudo systemctl status postgresql
sudo journalctl -u postgresql -f

# 2. Verify network connectivity
# From web server to database
telnet postgres-server 5432

# 3. Check firewall rules
sudo ufw status
sudo iptables -L -n | grep 5432

# 4. Test with psql
psql -h postgres-server -U emmatresor_user -d emmatresor_db
```

#### Issue: SSL/HTTPS Problems
```bash
# Symptoms
Mixed content warnings
SSL certificate errors
HTTPS redirects not working

# Solutions
# 1. Check certificate configuration
sudo certbot --nginx certonly
# Ensure certificate covers all domains

# 2. Verify nginx SSL configuration
server {
    listen 443 ssl http2;
    ssl_certificate /etc/letsencrypt/live/domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/domain.com/privkey.pem;
}

# 3. Test SSL configuration
openssl s_client -connect domain.com:443 -servername domain.com

# 4. Check HSTS headers
curl -I https://domain.com
# Should include: Strict-Transport-Security: max-age=31536000
```

## Debugging Techniques

### Backend Debugging

#### Django Debug Toolbar
```python
# Enable debug toolbar
INSTALLED_APPS = [
    # ... other apps
    'debug_toolbar',
]

MIDDLEWARE = [
    # ... other middleware
    'debug_toolbar.middleware.DebugToolbarMiddleware',
]

INTERNAL_IPS = ['127.0.0.1']

# Access in development
# Visit: http://localhost:8000/?__debug_toolbar__
```

#### Logging Configuration
```python
# Comprehensive logging setup
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'datefmt': '%Y-%m-%d %H:%M:%S',
        },
        'detailed': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message} | {exc_info}',
            'datefmt': '%Y-%m-%d %H:%M:%S',
        },
    },
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': '/var/log/emmatresor/app.log',
            'formatter': 'detailed',
        },
        'error_file': {
            'level': 'ERROR',
            'class': 'logging.FileHandler',
            'filename': '/var/log/emmatresor/error.log',
            'formatter': 'detailed',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['file', 'error_file'],
            'level': 'INFO',
            'propagate': False,
        },
        'inventory': {
            'handlers': ['file', 'error_file'],
            'level': 'DEBUG',
            'propagate': False,
        },
    },
}
```

#### Database Query Debugging
```python
# Enable query logging
LOGGING = {
    'loggers': {
        'django.db.backends': {
            'level': 'DEBUG',
            'handlers': ['console'],
        },
    },
}

# Add debugging to views
from django.db import connection

def debug_queryset(queryset):
    print(f"Query: {queryset.query}")
    print(f"SQL: {connection.queries}")
    return queryset
```

### Frontend Debugging

#### React DevTools
```typescript
// Debug component renders
import { useEffect } from 'react';

const DebugComponent = ({ data }) => {
  useEffect(() => {
    console.log('Component rendered with data:', data);
    
    // Debug re-renders
    const originalLog = console.log;
    console.log = (...args) => {
      originalLog('Render:', ...args);
    };
    
    return () => {
      console.log = originalLog;
    };
  }, [data]);
  
  // Component implementation
};

// Debug state changes
import { useAppStore } from '../store/authStore';

const StateDebugger = () => {
  const prevState = useRef();
  
  useEffect(() => {
    const currentState = useAppStore.getState();
    if (prevState.current !== currentState) {
      console.log('State changed:', {
        from: prevState.current,
        to: currentState,
      });
      prevState.current = currentState;
    }
  });
};
```

#### Network Request Debugging
```typescript
// Add request/response interceptors
apiClient.interceptors.request.use(config => {
  console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`, {
    data: config.data,
    headers: config.headers,
  });
  return config;
});

apiClient.interceptors.response.use(
  response => {
    console.log(`✅ API Response: ${config.method?.toUpperCase()} ${config.url}`, {
      status: response.status,
      data: response.data,
    });
    return response;
  },
  error => {
    console.error(`❌ API Error: ${error.message}`, {
        status: error.response?.status,
        data: error.response?.data,
        config: error.config,
      });
    return Promise.reject(error);
  }
);
```

#### Performance Profiling
```typescript
// React Profiler usage
<React.Profiler id="App" onRender={(id, phase, actualDuration) => {
  if (actualDuration > 100) {  // Log slow renders
    console.log(`⚠️ Slow render detected: ${id} ${phase} took ${actualDuration}ms`);
  }
}}>
  <App />
</React.Profiler>

// Web Vitals monitoring
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

const reportWebVitals = (metric) => {
  console.log(metric.name, metric.value);
  // Send to analytics service
};

// Initialize monitoring
getCLS(reportWebVitals);
getFID(reportWebVitals);
getFCP(reportWebVitals);
getLCP(reportWebVitals);
getTTFB(reportWebVitals);
```

## Common Error Messages

### Backend Error Messages

| Error Message | Cause | Solution |
|-------------|--------|----------|
| "CSRF token missing or incorrect" | CSRF cookie not set/expired | Clear browser cookies and re-authenticate |
| "Permission denied" | User lacks required permissions | Check user roles and permissions |
| "Database connection failed" | Database server down or wrong credentials | Verify database service and connection details |
| "Too many connections" | Exceeded database connection limit | Implement connection pooling or increase limit |
| "File too large" | Upload exceeds size limit | Increase MAX_FILE_SIZE in settings |
| "Invalid file type" | Unsupported file extension | Check ALLOWED_EXTENSIONS configuration |
| "Query timeout" | Database query too slow | Add indexes or optimize query |
| "Out of memory" | Exceeded memory allocation | Optimize memory usage in views |

### Frontend Error Messages

| Error Message | Cause | Solution |
|-------------|--------|----------|
| "Cannot read property 'X' of undefined" | Null/undefined access | Add proper null checks and optional chaining |
| "Network Error" | API request failed | Check network connection and API status |
| "CORS policy blocked" | Cross-origin request denied | Configure CORS settings properly |
| "Module not found" | Import path incorrect | Check import paths and module availability |
| "Failed to compile" | TypeScript errors | Run `npm run typecheck` and fix type issues |
| "Component crashed" | Unhandled exception | Add error boundaries and proper error handling |

This troubleshooting guide should help developers quickly identify and resolve common issues in the Emma-Tresor codebase. For issues not covered here, consult the developer guide or contact the development team.
