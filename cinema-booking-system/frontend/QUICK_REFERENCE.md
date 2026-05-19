# Quick Reference - Routes & Testing Guide

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open browser
# http://localhost:5173
```

---

## 🛣️ Route Navigation

### Testing Different Roles

Use these test emails to see role-specific dashboards:

#### Admin Login
```
Email: admin@example.com
Password: password123
Result: Redirects to /admin/dashboard
```

#### Staff Login
```
Email: staff@example.com
Password: password123
Result: Redirects to /staff/dashboard
```

#### Regular User Login
```
Email: user@example.com
Password: password123
Result: Redirects to /user/dashboard
```

---

## 📄 All Available Routes

| URL | Purpose | Auth Required | Role |
|-----|---------|---------------|------|
| `/` | Home page | No | Public |
| `/login` | Login form | No | Public |
| `/signup` | Register account | No | Public |
| `/forgot-password` | Password recovery | No | Public |
| `/user/dashboard` | User portal | Yes | USER |
| `/admin/dashboard` | Admin panel | Yes | ADMIN |
| `/staff/dashboard` | Staff panel | Yes | STAFF |

---

## 🧪 Testing Scenarios

### Scenario 1: User Registration
1. Go to `/signup`
2. Fill in all fields (email, name, password)
3. Click "Create Account"
4. Check console for: `📝 [SIGNUP] Creating account`
5. Should redirect to `/login`

### Scenario 2: User Login Flow
1. Go to `/login`
2. Enter `user@example.com` and `password123`
3. Check console for: `🔐 [AUTH] Login attempt`
4. Should redirect to `/user/dashboard`
5. User dashboard should show movies and bookings

### Scenario 3: Admin Access
1. Go to `/login`
2. Enter `admin@example.com` and `password123`
3. Should redirect to `/admin/dashboard`
4. Should see stats cards and movie management table
5. Check console for: `📊 [ADMIN] Fetching dashboard stats`

### Scenario 4: Staff Access
1. Go to `/login`
2. Enter `staff@example.com` and `password123`
3. Should redirect to `/staff/dashboard`
4. Should see today's stats and bookings table
5. Check console for: `👔 [STAFF] Fetching staff dashboard`

### Scenario 5: Forgot Password
1. Go to `/forgot-password`
2. Enter any email
3. Check console for: `📧 [FORGOT_PASSWORD] Sending reset email`
4. Should show success message

### Scenario 6: Logout
1. Login to any dashboard
2. Click "Logout" button
3. Should redirect to `/login`
4. Check console for: `🔓 [AUTH] Logout`

### Scenario 7: Protected Routes
1. Try accessing `/user/dashboard` without login
2. Should redirect to `/login`
3. Try accessing `/admin/dashboard` as non-admin user
4. Should redirect to `/`

---

## 🔍 Console Log Reference

### Authentication Logs
```
🔐 [AUTH] Login attempt: { email: '...', password: '...' }
✅ [AUTH] Login successful: { token: '...', user: { id: '...', email: '...', role: 'USER' } }
🔓 [AUTH] Logout
```

### Movie Logs
```
🎬 [MOVIE] Fetching movies...
✅ [MOVIE] Movies fetched: [{ id: 1, title: 'Interstellar', ... }]
🎬 [MOVIE] Fetching movie: 1
✅ [MOVIE] Movie fetched: { id: 1, title: 'Interstellar', ... }
```

### Showtime Logs
```
🕐 [SHOWTIME] Fetching showtimes for movie: 1
✅ [SHOWTIME] Showtimes fetched: [{ id: 1, time: '10:00 AM', ... }]
```

### Booking Logs
```
🎫 [BOOKING] Creating booking: { totalPrice: 400000, seats: ['A1', 'A2'] }
✅ [BOOKING] Booking created: { id: 'booking-...', status: 'confirmed', ... }
🎫 [BOOKING] Fetching user bookings...
✅ [BOOKING] Bookings fetched: [{ id: 'booking-1', movieTitle: 'Interstellar', ... }]
```

### Admin Logs
```
📊 [ADMIN] Fetching dashboard stats...
✅ [ADMIN] Stats fetched: { totalBookings: 1543, totalRevenue: 308600000, ... }
🎬 [ADMIN] Fetching movies for management...
✅ [ADMIN] Movies fetched: [{ id: 1, title: 'Interstellar', status: 'active', ... }]
🎬 [ADMIN] Creating movie: { title: 'New Movie', ... }
✅ [ADMIN] Movie created: { id: ..., title: 'New Movie', ... }
👥 [ADMIN] Fetching users for management...
✅ [ADMIN] Users fetched: [{ id: 1, email: 'user1@example.com', ... }]
```

### Staff Logs
```
👔 [STAFF] Fetching staff dashboard...
✅ [STAFF] Dashboard data fetched: { todayBookings: 47, totalTicketsSold: 98, ... }
📋 [STAFF] Fetching bookings list...
✅ [STAFF] Bookings list fetched: [{ id: 'booking-1', customer: 'John Doe', ... }]
```

### Signup & Password Logs
```
📝 [SIGNUP] Creating account: { fullName: 'John Doe', email: 'john@example.com' }
✅ [SIGNUP] Account created successfully
📧 [FORGOT_PASSWORD] Sending reset email to: user@example.com
✅ [FORGOT_PASSWORD] Reset email sent successfully
```

---

## ✨ Key Features Tested

### Authentication
- ✅ Login with email & password
- ✅ Form validation (email format, password length)
- ✅ Error handling & display
- ✅ Loading states
- ✅ Role-based redirection
- ✅ Token storage & retrieval

### User Dashboard
- ✅ Movies grid display
- ✅ Movie booking functionality
- ✅ Bookings history display
- ✅ Logout functionality
- ✅ Responsive mobile navigation

### Admin Dashboard
- ✅ Dashboard stats cards with trends
- ✅ Movies management table
- ✅ Edit/Delete movie buttons
- ✅ Add movie button
- ✅ User management section

### Staff Dashboard
- ✅ Today's overview cards
- ✅ Bookings list table
- ✅ Customer information display
- ✅ Real-time metrics

### Navigation
- ✅ Public routes accessible without login
- ✅ Protected routes require authentication
- ✅ Role-based route protection
- ✅ Proper redirects on unauthorized access

---

## 🐛 Debugging Tips

### Open Developer Console
- **Chrome/Edge**: F12 or Ctrl+Shift+I
- **Firefox**: F12 or Ctrl+Shift+I
- **Safari**: Cmd+Option+I

### Check Console Logs
1. Perform any action (login, fetch data, etc.)
2. Look for colored emoji-prefixed logs
3. Check the logged objects for data structure

### Check Network Tab
1. Open DevTools → Network tab
2. Watch for API calls (when real backend is connected)
3. Check request/response payloads

### Check Application/Storage
1. Open DevTools → Application tab
2. Check localStorage for `authToken`
3. Verify auth state in Redux/Zustand (if using DevTools)

### Check Component State
1. Install React DevTools browser extension
2. Open DevTools → Components tab
3. Inspect component props and state
4. Check store updates in real-time

---

## 🔗 Integration with Real Backend

### Update API Endpoints

In `src/services/apiService.ts`, uncomment real API calls:

```typescript
// Before (mock):
console.log('🔐 [AUTH] Login attempt:', credentials);
const mockResponse = { token: '...', user: { ... } };

// After (real):
const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
if (response.data.token) {
  localStorage.setItem('authToken', response.data.token);
}
return response.data;
```

### Update Environment Variables

Edit `.env.local`:
```
VITE_API_BASE_URL=https://your-backend-api.com/api
```

### Verify Backend Endpoints

Ensure your backend provides:
```
POST /api/auth/login
POST /api/auth/signup
POST /api/auth/forgot-password
GET /api/movies
GET /api/showtimes?movieId=1
POST /api/bookings
GET /api/bookings (user)
GET /api/admin/stats
GET /api/admin/movies
GET /api/admin/users
GET /api/staff/dashboard
GET /api/staff/bookings
```

---

## 📊 Mock Data Breakdown

### Login Response
```javascript
{
  token: "mock-jwt-token-1234567890",
  user: {
    id: "user-abc123def456",
    email: "user@example.com",
    role: "USER" | "ADMIN" | "STAFF"
  }
}
```

### Movies Array
```javascript
[
  {
    id: 1,
    title: "Interstellar",
    genre: "Sci-Fi",
    rating: 8.6,
    poster: "https://via.placeholder.com/..."
  },
  // ... more movies
]
```

### User Bookings
```javascript
[
  {
    id: "booking-1",
    movieTitle: "Interstellar",
    date: "2024-05-20",
    status: "confirmed",
    seats: ["A1", "A2"]
  },
  // ... more bookings
]
```

### Admin Stats
```javascript
{
  totalBookings: 1543,
  totalRevenue: 308600000,
  activeUsers: 487,
  totalMovies: 24
}
```

---

## 💡 Tips & Tricks

1. **Clear Browser Cache**: Ctrl+Shift+Delete to clear localStorage
2. **Check All Console Messages**: Expand console objects to see full data
3. **Test Different Browsers**: Check responsive design on Chrome, Firefox, Safari
4. **Mobile Testing**: Open DevTools → Toggle device toolbar (Ctrl+Shift+M)
5. **Disable Cache**: In DevTools → Network tab → Check "Disable cache"
6. **Copy Console Logs**: Right-click → Save as for debugging records

---

## 🚨 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Routes not loading | Restart dev server (`npm run dev`) |
| Styles not applying | Hard refresh (Ctrl+F5) or clear cache |
| Token not persisting | Check if localStorage is enabled in browser |
| Redirect loops | Clear localStorage and try fresh login |
| API calls failing | Check .env.local is set correctly |
| Components not rendering | Check if all imports are correct |

---

## 📝 Checklist for Production Deployment

- [ ] Uncomment real API calls in services
- [ ] Update `.env` variables for production
- [ ] Test all endpoints with real backend
- [ ] Verify HTTPS is enforced
- [ ] Check CORS configuration on backend
- [ ] Add error handling for network failures
- [ ] Implement logging service
- [ ] Add analytics
- [ ] Set up monitoring
- [ ] Create deployment documentation
- [ ] Perform security audit
- [ ] Test on real mobile devices
- [ ] Performance optimization (lazy loading, code splitting)
- [ ] SEO optimization
- [ ] Accessibility audit (WCAG compliance)

---

## 🎯 Next Steps

1. **Connect Real Backend**: Uncomment API calls and test
2. **Add More Pages**: Booking confirmation, movie details
3. **Implement Payment**: Add payment processing
4. **Add Reviews**: User ratings and comments
5. **Push Notifications**: Email/SMS confirmations
6. **Analytics**: Track user behavior
7. **Performance**: Optimize bundle size and load times

---

**Happy Testing! 🎉**
