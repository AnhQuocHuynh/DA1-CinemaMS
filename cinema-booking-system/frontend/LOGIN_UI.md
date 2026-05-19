# Login UI Implementation

This document describes the Login UI implementation for CinemaArchitect.

## Components

### 1. **Login Page** (`src/pages/Login.tsx`)
Main login page component featuring:
- Modern Material Design 3 UI
- Email and password input fields with validation
- Error handling and display
- Loading state during authentication
- Responsive design (mobile-first)
- Background carousel showcase
- System status and quick stats cards

**Props**: None (uses React Router and Zustand)

**Key Features**:
- Real-time form validation
- Clear error messages for invalid inputs
- Loading indicator during API call
- Auto-navigation based on user role
- "Forgot Password" and "Sign Up" links

### 2. **InputField Component** (`src/components/InputField.tsx`)
Reusable input component with:
- Icon support (using Lucide React)
- Label and validation error display
- Focus states and transitions
- Material Design styling

**Props**:
```typescript
interface InputFieldProps {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  icon?: LucideIcon;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  required?: boolean;
}
```

### 3. **Header Component** (`src/components/Header.tsx`)
Navigation header featuring:
- CinemaArchitect branding
- Navigation links
- Sign In and Book Now buttons
- Glass-morphism effect
- Responsive design

## Services

### **Auth Service** (`src/services/authService.ts`)
Handles all authentication API calls:
- `login()`: Authenticate user with email/password
- `logout()`: Clear auth token
- `isAuthenticated()`: Check if user is logged in
- `getToken()`: Retrieve stored auth token

Features:
- Automatic token management
- Request interceptor for auth headers
- Local storage persistence

## State Management

### **Auth Store** (`src/store/authStore.ts`)
Zustand store for global auth state:
- User info (id, email, role)
- Auth token
- Loading state
- Error state

Actions:
- `setUser()`: Update user info
- `setToken()`: Store/clear auth token
- `setIsLoading()`: Update loading state
- `setError()`: Set error message
- `logout()`: Clear all auth data
- `reset()`: Reset to initial state

## Custom Hooks

### **useLogin** (`src/hooks/useLogin.ts`)
Simplified login hook combining service and store:
```typescript
const { login } = useLogin();
await login({ email, password });
```

## Types

### **Auth Types** (`src/types/auth.ts`)
- `LoginFormData`: Email and password
- `LoginResponse`: Token and user info
- `AuthError`: Error details

## Styling

### **Tailwind Configuration**
Material Design 3 colors are configured:
- Primary: `#004ac6`
- Secondary: `#545f73`
- Error: `#ba1a1a`
- Surface variants for depth
- All Material Design 3 tokens available

### **Global Styles** (`src/index.css`)
- `.glass-header`: Glass-morphism effect
- `.tonal-zone`: Surface container styling

## Setup

### 1. Environment Configuration
Create `.env.local` based on `.env.example`:
```
VITE_API_BASE_URL=http://localhost:8080/api
```

### 2. Routing Setup
Add the Login route to your main routing configuration:
```typescript
import { Login } from './pages/Login';

// In your router configuration:
{
  path: '/login',
  element: <Login />,
}
```

### 3. Backend API Endpoint
Ensure your backend has:
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

Response:
{
  "token": "jwt_token_here",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "USER" | "ADMIN" | "STAFF"
  }
}
```

## Validation Rules

- **Email**: Must be a valid email format
- **Password**: Minimum 6 characters

## Error Handling

- Invalid credentials: Shows user-friendly error message
- Network errors: Caught and displayed to user
- Form validation errors: Shown inline with each field

## Accessibility

- Semantic HTML with proper labels
- ARIA attributes for screen readers
- Keyboard navigation support
- High contrast colors (WCAG compliant)

## Mobile Responsiveness

- Full-screen modal on desktop
- Adapted layout for tablets
- Bottom navigation for mobile
- Touch-optimized inputs (48px minimum height)

## Future Enhancements

- [ ] Remember me checkbox
- [ ] Social login (Google, Facebook)
- [ ] Two-factor authentication
- [ ] Biometric login support
- [ ] Password strength indicator
- [ ] Session timeout warning
