# Login UI Setup Guide

## Files Created

The Login UI implementation includes the following files:

### Core Components
- `src/pages/Login.tsx` - Main login page
- `src/components/InputField.tsx` - Reusable input component
- `src/components/Header.tsx` - Navigation header
- `src/components/ProtectedRoute.tsx` - Route protection wrapper

### Services & State
- `src/services/authService.ts` - Authentication API service
- `src/store/authStore.ts` - Zustand auth store
- `src/hooks/useLogin.ts` - Custom login hook
- `src/types/auth.ts` - TypeScript interfaces

### Configuration
- `src/index.css` - Global styles with Material Design 3 colors
- `tailwind.config.js` - Updated with MD3 color palette
- `.env.example` - Environment template

### Documentation
- `LOGIN_UI.md` - Component documentation
- `App.example.tsx` - Router setup example

---

## Integration Steps

### 1. Update App.tsx
Replace the content of `src/App.tsx` with the router configuration from `App.example.tsx`, or manually add the login route:

```typescript
import { Login } from './pages/Login';

<Route path="/login" element={<Login />} />
```

### 2. Create Environment File
```bash
# Copy example to local environment
cp .env.example .env.local
```

Update `.env.local` with your backend API URL:
```
VITE_API_BASE_URL=http://localhost:8080/api
```

### 3. Start Development Server
```bash
npm run dev
```

Visit `http://localhost:5173/login` to view the login page.

---

## Backend Integration

### Required API Endpoint

Your backend must provide a login endpoint:

```
POST /api/auth/login
Content-Type: application/json

Request Body:
{
  "email": "user@example.com",
  "password": "password123"
}

Response (200 OK):
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "role": "USER"
  }
}

Error Response (401 Unauthorized):
{
  "message": "Invalid credentials"
}
```

---

## Usage Examples

### Basic Login
```typescript
import { Login } from './pages/Login';

// In your router:
<Route path="/login" element={<Login />} />
```

### Using useLogin Hook
```typescript
import { useLogin } from './hooks/useLogin';

function MyComponent() {
  const { login } = useLogin();

  const handleLogin = async () => {
    try {
      await login({ 
        email: 'user@example.com', 
        password: 'password' 
      });
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return <button onClick={handleLogin}>Login</button>;
}
```

### Protecting Routes
```typescript
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminDashboard } from './pages/admin/AdminDashboard';

<Routes>
  <Route 
    path="/admin/dashboard" 
    element={
      <ProtectedRoute requiredRole="ADMIN">
        <AdminDashboard />
      </ProtectedRoute>
    } 
  />
</Routes>
```

### Accessing Auth State
```typescript
import { useAuthStore } from './store/authStore';

function ProfileComponent() {
  const { user, logout } = useAuthStore();

  return (
    <div>
      <p>Logged in as: {user?.email}</p>
      <p>Role: {user?.role}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

---

## Customization

### Change API Base URL
Edit `.env.local`:
```
VITE_API_BASE_URL=https://api.yourdomain.com
```

### Customize Colors
Edit `tailwind.config.js` to change Material Design 3 colors in the `colors` section.

### Add Forgot Password
Create `src/pages/ForgotPassword.tsx` and add route:
```typescript
<Route path="/forgot-password" element={<ForgotPassword />} />
```

### Add Sign Up
Create `src/pages/SignUp.tsx` and add route:
```typescript
<Route path="/signup" element={<SignUp />} />
```

---

## Testing

### Manual Testing Checklist
- [ ] Login with valid credentials
- [ ] Login with invalid email format
- [ ] Login with empty password
- [ ] Verify error messages display correctly
- [ ] Verify navigation after successful login
- [ ] Test on mobile (using Chrome DevTools)
- [ ] Test on tablet
- [ ] Test keyboard navigation

### Example Test Credentials
You can add these credentials to your backend for testing:
```
Email: user@example.com
Password: password123
Role: USER

Email: admin@example.com
Password: admin123
Role: ADMIN
```

---

## Common Issues

### Token Not Persisting
Ensure localStorage is enabled in the browser and check browser console for any errors.

### CORS Errors
Configure CORS on your backend to accept requests from `http://localhost:5173`.

### Wrong Navigation After Login
Check that your backend returns the correct user role in the response.

### Styling Not Applied
Ensure Tailwind CSS is properly configured and the development server is running.

---

## Performance Optimization

- Components use React.memo (consider adding if needed)
- API calls use Zustand for efficient state management
- Images are loaded from CDN
- CSS-in-JS is minimal to reduce bundle size

---

## Accessibility

- All inputs have associated labels
- Error messages linked to form fields
- Keyboard navigation fully supported
- High contrast colors (WCAG AA compliant)
- Focus states clearly visible
- Icons paired with text labels

---

## Next Steps

1. ✅ Implement Login UI (Done)
2. Implement Forgot Password page
3. Implement Sign Up page
4. Create dashboard pages for each role
5. Add user profile/settings page
6. Implement logout functionality
7. Add session timeout warning
8. Implement two-factor authentication

---

## Support & Questions

For issues or questions about the Login UI implementation, refer to:
- `LOGIN_UI.md` - Component documentation
- Component files have inline comments
- TypeScript interfaces provide type hints
