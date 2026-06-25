import { Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { SignUp } from './pages/SignUp';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Home } from './pages/Home';
import { MovieDetails } from './pages/MovieDetails';
import { MovieShowtimes } from './pages/MovieShowtimes';
import { MovieSearch } from './pages/MovieSearch';
import { EventDetails } from './pages/EventDetails';
import { HealthCheck } from './pages/HealthCheck';
import { Theaters } from './pages/Theaters';
import { Membership } from './pages/Membership';
import { UserDashboard } from './pages/portal/UserDashboard';
import { Booking } from './pages/portal/Booking';
import { Checkout } from './pages/portal/Checkout';
import { CheckoutSuccess } from './pages/portal/CheckoutSuccess';
import { TicketInfo } from './pages/portal/TicketInfo';
import { Settings } from './pages/portal/Settings';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { MovieManagement } from './pages/admin/MovieManagement';
import { EventManagement } from './pages/admin/EventManagement';
import { PermissionManagement } from './pages/admin/PermissionManagement';
import { PricingAndVouchers } from './pages/admin/PricingAndVouchers';
import { RoomManagement } from './pages/admin/RoomManagement';
import { SeatConfigurator } from './pages/admin/SeatConfigurator';
import { ShowtimeManagement } from './pages/admin/ShowtimeManagement';
import { StaffDashboard } from './pages/staff/StaffDashboard';
import { CounterBooking } from './pages/staff/CounterBooking';
import { TicketLookup } from './pages/staff/TicketLookup';
import { QRChecker } from './pages/staff/QRChecker';
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Home />} />
      <Route path="/theaters" element={<Theaters />} />
      <Route path="/membership" element={<Membership />} />
      <Route path="/movies/:movieId" element={<MovieDetails />} />
      <Route path="/movies/:movieId/showtimes" element={<MovieShowtimes />} />
      <Route path="/events/:eventId" element={<EventDetails />} />
      <Route path="/events/:eventId/showtimes" element={<MovieShowtimes />} />
      <Route path="/movies/search" element={<MovieSearch />} />
      <Route path="/health-check" element={<HealthCheck />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected User Routes */}
      <Route
        path="/my-tickets"
        element={
          <ProtectedRoute requiredRole="USER">
            <UserDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="/user/dashboard" element={<Navigate to="/my-tickets" replace />} />
      <Route path="/user/booking/:showtimeId" element={<ProtectedRoute requiredRole="USER"><Booking /></ProtectedRoute>} />
      <Route path="/user/checkout" element={<ProtectedRoute requiredRole="USER"><Checkout /></ProtectedRoute>} />
      <Route path="/user/checkout-success" element={<ProtectedRoute requiredRole="USER"><CheckoutSuccess /></ProtectedRoute>} />
      <Route path="/user/tickets/:ticketId" element={<ProtectedRoute requiredRole="USER"><TicketInfo /></ProtectedRoute>} />
      <Route path="/user/settings" element={<ProtectedRoute requiredRole="USER"><Settings /></ProtectedRoute>} />

      {/* Protected Admin Routes */}
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="/admin/movies" element={<ProtectedRoute requiredRole="ADMIN"><MovieManagement /></ProtectedRoute>} />
      <Route path="/admin/events" element={<ProtectedRoute requiredRole="ADMIN"><EventManagement /></ProtectedRoute>} />
      <Route path="/admin/permissions" element={<ProtectedRoute requiredRole="ADMIN"><PermissionManagement /></ProtectedRoute>} />
      <Route path="/admin/pricing" element={<ProtectedRoute requiredRole="ADMIN"><PricingAndVouchers /></ProtectedRoute>} />
      <Route path="/admin/rooms" element={<ProtectedRoute requiredRole="ADMIN"><RoomManagement /></ProtectedRoute>} />
      <Route path="/admin/rooms/:roomId/seats" element={<ProtectedRoute requiredRole="ADMIN"><SeatConfigurator /></ProtectedRoute>} />
      <Route path="/admin/showtimes" element={<ProtectedRoute requiredRole="ADMIN"><ShowtimeManagement /></ProtectedRoute>} />

      {/* Protected Staff Routes */}
      <Route
        path="/staff/dashboard"
        element={
          <ProtectedRoute requiredRole="STAFF">
            <StaffDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="/staff/ticket-lookup" element={<ProtectedRoute requiredRole="STAFF"><TicketLookup /></ProtectedRoute>} />
      <Route path="/staff/bookings/new" element={<ProtectedRoute requiredRole="STAFF"><CounterBooking /></ProtectedRoute>} />
      <Route path="/staff/qr-checker" element={<ProtectedRoute requiredRole="STAFF"><QRChecker /></ProtectedRoute>} />

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
