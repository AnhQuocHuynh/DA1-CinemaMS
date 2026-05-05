import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, BarChart3, Film, Users } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { adminService } from '../../services/apiService';

interface StatCard {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
}

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [movies, setMovies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [statsData, moviesData] = await Promise.all([
          adminService.getDashboardStats(),
          adminService.getMovieManagement(),
        ]);
        setStats(statsData);
        setMovies(moviesData);
      } catch (error) {
        console.error('Failed to load admin data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const handleLogout = () => {
    console.log('👤 [ADMIN] Logout clicked');
    logout();
    navigate('/');
  };

  const statCards: StatCard[] = stats ? [
    {
      title: 'Total Bookings',
      value: stats.totalBookings,
      icon: <BarChart3 className="w-6 h-6 text-primary" />,
      trend: '+12% vs last month',
    },
    {
      title: 'Revenue',
      value: `₫${(stats.totalRevenue / 1000000).toFixed(1)}M`,
      icon: <BarChart3 className="w-6 h-6 text-green-600" />,
      trend: '+8% vs last month',
    },
    {
      title: 'Active Users',
      value: stats.activeUsers,
      icon: <Users className="w-6 h-6 text-blue-600" />,
      trend: '+25 new users',
    },
    {
      title: 'Total Movies',
      value: stats.totalMovies,
      icon: <Film className="w-6 h-6 text-purple-600" />,
      trend: '+3 new movies',
    },
  ] : [];

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md shadow-sm h-16 flex justify-between items-center px-8">
        <div className="flex items-center gap-8">
          <span className="text-xl font-bold tracking-tighter text-slate-900">CinemaArchitect - Admin</span>
          <div className="hidden md:flex space-x-6">
            <a href="#dashboard" className="text-slate-600 hover:text-slate-900 transition-colors font-medium text-sm">
              Dashboard
            </a>
            <a href="#movies" className="text-slate-600 hover:text-slate-900 transition-colors font-medium text-sm">
              Movies
            </a>
            <a href="#users" className="text-slate-600 hover:text-slate-900 transition-colors font-medium text-sm">
              Users
            </a>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600">{user?.email}</span>
          <button
            onClick={handleLogout}
            className="bg-error text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-red-700 transition-all flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 px-8 pb-8">
        <div className="max-w-7xl mx-auto">
          {/* Title */}
          <section className="mb-12">
            <h1 className="text-4xl font-bold text-on-surface mb-2">Admin Dashboard 📊</h1>
            <p className="text-on-surface-variant">Manage your cinema system and view business metrics</p>
          </section>

          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-on-surface-variant">Loading dashboard...</p>
            </div>
          ) : (
            <>
              {/* Stats Grid */}
              <section id="dashboard" className="mb-12">
                <h2 className="text-2xl font-bold text-on-surface mb-6">Key Metrics</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {statCards.map((stat, index) => (
                    <div key={index} className="bg-surface-container rounded-xl p-6 border border-outline-variant/30">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-on-surface-variant text-sm mb-2">{stat.title}</p>
                          <p className="text-3xl font-bold text-on-surface">{stat.value}</p>
                        </div>
                        {stat.icon}
                      </div>
                      {stat.trend && (
                        <p className="text-xs text-green-600 font-semibold">{stat.trend}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* Movies Management */}
              <section id="movies" className="mb-12">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-on-surface flex items-center gap-2">
                    <Film className="w-6 h-6 text-primary" />
                    Movies Management
                  </h2>
                  <button className="px-4 py-2 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-blue-700">
                    + Add Movie
                  </button>
                </div>
                <div className="bg-surface-container rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-surface-container-high border-b border-outline-variant/30">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-bold text-on-surface">Title</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-on-surface">Status</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-on-surface">Bookings</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-on-surface">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movies.map((movie, index) => (
                        <tr key={index} className="border-b border-outline-variant/20 hover:bg-surface-container-low transition-colors">
                          <td className="px-6 py-4 text-on-surface">{movie.title}</td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              movie.status === 'active' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {movie.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-on-surface">{movie.bookings}</td>
                          <td className="px-6 py-4 space-x-2">
                            <button className="px-3 py-1 bg-primary text-white rounded text-xs hover:bg-blue-700">Edit</button>
                            <button className="px-3 py-1 bg-error text-white rounded text-xs hover:bg-red-700">Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Users Management */}
              <section id="users">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-on-surface flex items-center gap-2">
                    <Users className="w-6 h-6 text-primary" />
                    Users Management
                  </h2>
                  <button className="px-4 py-2 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-blue-700">
                    + Add User
                  </button>
                </div>
                <div className="bg-surface-container rounded-xl p-6 text-center">
                  <p className="text-on-surface-variant">Users management section will be implemented here</p>
                  <p className="text-sm text-on-surface-variant mt-2">Total users: 487</p>
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
};
