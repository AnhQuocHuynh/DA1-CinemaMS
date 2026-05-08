import { Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { SignUp } from './pages/SignUp';
import { ForgotPassword } from './pages/ForgotPassword';
import { Home } from './pages/Home';
import { MovieDetails } from './pages/MovieDetails';
import { MovieSearch } from './pages/MovieSearch';
import { UserDashboard } from './pages/portal/UserDashboard';
import { Booking } from './pages/portal/Booking';
import { Checkout } from './pages/portal/Checkout';
import { CheckoutSuccess } from './pages/portal/CheckoutSuccess';
import { TicketInfo } from './pages/portal/TicketInfo';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { MovieManagement } from './pages/admin/MovieManagement';
import { PermissionManagement } from './pages/admin/PermissionManagement';
import { PricingAndVouchers } from './pages/admin/PricingAndVouchers';
import { RoomManagement } from './pages/admin/RoomManagement';
import { ShowtimeManagement } from './pages/admin/ShowtimeManagement';
import { StaffDashboard } from './pages/staff/StaffDashboard';
import { TicketLookup } from './pages/staff/TicketLookup';
import { QRChecker } from './pages/staff/QRChecker';
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
      <Route path="/user/booking" element={<Booking />} />
      <Route path="/user/checkout" element={<Checkout />} />
      <Route path="/user/checkout-success" element={<CheckoutSuccess />} />
      <Route path="/user/tickets/:ticketId" element={<TicketInfo />} />

      {/* Protected Admin Routes */}
      <Route
        path="/admin/dashboard"
        element={
        //  <ProtectedRoute requiredRole="ADMIN">
            <AdminDashboard />
        //  </ProtectedRoute>
        }
      />
      <Route path="/admin/movies" element={<MovieManagement />} />
      <Route path="/admin/permissions" element={<PermissionManagement />} />
      <Route path="/admin/pricing" element={<PricingAndVouchers />} />
      <Route path="/admin/rooms" element={<RoomManagement />} />
      <Route path="/admin/showtimes" element={<ShowtimeManagement />} />

      {/* Protected Staff Routes */}
      <Route
        path="/staff/dashboard"
        element={
        //  <ProtectedRoute requiredRole="STAFF">
            <StaffDashboard />
        //  </ProtectedRoute>
        }
      />
      <Route path="/staff/ticket-lookup" element={<TicketLookup />} />
      <Route path="/staff/qr-checker" element={<QRChecker />} />

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
