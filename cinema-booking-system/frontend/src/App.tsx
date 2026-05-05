import { Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { SignUp } from './pages/SignUp';
import { ForgotPassword } from './pages/ForgotPassword';
import { Home } from './pages/Home';
import { MovieDetails } from './pages/MovieDetails';
import { MovieSearch } from './pages/MovieSearch';
import { UserDashboard } from './pages/portal/UserDashboard';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { StaffDashboard } from './pages/staff/StaffDashboard';
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Home />} />
      <Route path="/movies/:movieId" element={<MovieDetails />} />
      <Route path="/movies/search" element={<MovieSearch />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Protected User Routes */}
      <Route
        path="/user/dashboard"
        element={
        //  <ProtectedRoute requiredRole="USER">
            <UserDashboard />
        //</ProtectedRoute>
        }
      />

      {/* Protected Admin Routes */}
      <Route
        path="/admin/dashboard"
        element={
        //  <ProtectedRoute requiredRole="ADMIN">
            <AdminDashboard />
        //  </ProtectedRoute>
        }
      />

      {/* Protected Staff Routes */}
      <Route
        path="/staff/dashboard"
        element={
        //  <ProtectedRoute requiredRole="STAFF">
            <StaffDashboard />
        //  </ProtectedRoute>
        }
      />

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
