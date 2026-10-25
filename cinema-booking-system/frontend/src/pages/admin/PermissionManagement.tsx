import React, { useState, useMemo } from 'react';
import { Building2, Search, AlertCircle, CheckCircle2 } from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { AdminTopBar } from '../../components/admin/AdminTopBar';
import { useAdminPermissions } from '../../hooks/useAdminPermissions';
import { UserRoleModal } from '../../components/admin/modals/UserRoleModal';
import { useToast } from '../../contexts/ToastContext';

export const PermissionManagement: React.FC = () => {
  const { users, cinemas, isLoading, updateUserRole, assignStaffCinema, deleteUser } = useAdminPermissions();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<'users' | 'cinema-assignment'>('users');
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cinemaFilter, setCinemaFilter] = useState<string>('all');

  const cinemaMap = useMemo(() => new Map(cinemas.map((c) => [c.id, c])), [cinemas]);

  const handleEditClick = (user: any) => {
    setSelectedUser(user);
    setIsRoleModalOpen(true);
  };

  const handleDeleteClick = async (id: string | number) => {
    if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      await deleteUser(id);
    }
  };

  const handleRoleSubmit = async (data: any) => {
    if (selectedUser) {
      await updateUserRole(selectedUser.id, data);
    }
  };

  const handleInlineCinemaChange = async (userId: string | number, userName: string, rawCinemaId: string) => {
    const targetCinemaId = rawCinemaId ? Number(rawCinemaId) : null;
    try {
      await assignStaffCinema(userId, targetCinemaId);
      addToast(
        targetCinemaId
          ? `Assigned ${userName} to ${cinemaMap.get(targetCinemaId)?.name || 'cinema'}`
          : `Unassigned cinema from ${userName}`,
        'success'
      );
    } catch (err: any) {
      addToast(err?.message || 'Failed to update cinema assignment', 'error');
    }
  };

  const totalUsers = users.length;
  const staffUsers = useMemo(() => users.filter((user) => user.roles.staff), [users]);
  const activeStaff = staffUsers.length;
  const assignedStaffCount = useMemo(() => staffUsers.filter((u) => u.cinemaId).length, [staffUsers]);
  const unassignedStaffCount = activeStaff - assignedStaffCount;

  // Filtered lists
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase();
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    });
  }, [users, searchQuery]);

  const filteredStaff = useMemo(() => {
    return staffUsers.filter((u) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (cinemaFilter === 'all') return true;
      if (cinemaFilter === 'unassigned') return !u.cinemaId;
      return String(u.cinemaId) === cinemaFilter;
    });
  }, [staffUsers, searchQuery, cinemaFilter]);

  return (
    <AdminLayout activeItemId="permissions">
      <AdminTopBar title="Admin Console" searchPlaceholder="Search users, roles, or staff..." />
      <main className="p-6 md:p-8 space-y-8">
        <AdminPageHeader
          title="User & Access Management"
          subtitle="Configure user roles, Keycloak permissions, and staff cinema assignments across branches."
        />

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 gap-8">
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`pb-3 text-sm font-bold uppercase tracking-wider transition-all relative ${
              activeTab === 'users'
                ? 'text-blue-700 border-b-2 border-blue-700'
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            All Users ({totalUsers})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cinema-assignment')}
            className={`pb-3 text-sm font-bold uppercase tracking-wider transition-all relative flex items-center gap-2 ${
              activeTab === 'cinema-assignment'
                ? 'text-blue-700 border-b-2 border-blue-700'
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Cinema Assignment ({activeStaff} Staff)</span>
            {unassignedStaffCount > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full animate-pulse">
                {unassignedStaffCount} unassigned
              </span>
            )}
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-10 text-on-surface-variant">Loading user permissions...</div>
        ) : (
          <>
            {/* Stat Cards */}
            {activeTab === 'users' ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="bg-surface-container-lowest p-6 flex flex-col justify-between h-32 rounded-lg shadow-sm border border-slate-100">
                  <span className="text-[0.7rem] uppercase tracking-widest font-semibold text-slate-400">Total Users</span>
                  <span className="text-4xl font-bold tracking-tight text-slate-900">{totalUsers}</span>
                </div>
                <div className="bg-surface-container-low p-6 flex flex-col justify-between h-32 border-l-4 border-blue-600 rounded-lg shadow-sm">
                  <span className="text-[0.7rem] uppercase tracking-widest font-semibold text-blue-600">Active Staff</span>
                  <span className="text-4xl font-bold tracking-tight text-slate-900">{activeStaff}</span>
                </div>
                <div className="bg-surface-container-lowest p-6 flex flex-col justify-between h-32 rounded-lg shadow-sm border border-slate-100">
                  <span className="text-[0.7rem] uppercase tracking-widest font-semibold text-slate-400">Staff Assigned</span>
                  <span className="text-4xl font-bold tracking-tight text-green-600">{assignedStaffCount}</span>
                </div>
                <div className="bg-surface-container-lowest p-6 flex flex-col justify-between h-32 rounded-lg shadow-sm border border-slate-100">
                  <span className="text-[0.7rem] uppercase tracking-widest font-semibold text-slate-400">Total Cinemas</span>
                  <span className="text-4xl font-bold tracking-tight text-slate-900">{cinemas.length}</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="bg-surface-container-lowest p-6 flex flex-col justify-between h-32 rounded-lg shadow-sm border border-slate-100">
                  <span className="text-[0.7rem] uppercase tracking-widest font-semibold text-slate-400">Total Staff</span>
                  <span className="text-4xl font-bold tracking-tight text-slate-900">{activeStaff}</span>
                </div>
                <div className="bg-surface-container-low p-6 flex flex-col justify-between h-32 border-l-4 border-green-600 rounded-lg shadow-sm">
                  <span className="text-[0.7rem] uppercase tracking-widest font-semibold text-green-700">Assigned to Cinema</span>
                  <span className="text-4xl font-bold tracking-tight text-green-700">{assignedStaffCount}</span>
                </div>
                <div className={`p-6 flex flex-col justify-between h-32 rounded-lg shadow-sm border ${unassignedStaffCount > 0 ? 'bg-amber-50 border-amber-200 border-l-4 border-l-amber-500' : 'bg-surface-container-lowest border-slate-100'}`}>
                  <span className={`text-[0.7rem] uppercase tracking-widest font-semibold ${unassignedStaffCount > 0 ? 'text-amber-800' : 'text-slate-400'}`}>
                    Unassigned Staff
                  </span>
                  <span className={`text-4xl font-bold tracking-tight ${unassignedStaffCount > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
                    {unassignedStaffCount}
                  </span>
                </div>
                <div className="bg-surface-container-lowest p-6 flex flex-col justify-between h-32 rounded-lg shadow-sm border border-slate-100">
                  <span className="text-[0.7rem] uppercase tracking-widest font-semibold text-slate-400">Cinema Branches</span>
                  <span className="text-4xl font-bold tracking-tight text-slate-900">{cinemas.length}</span>
                </div>
              </div>
            )}

            {/* Filter / Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-lg shadow-sm border border-slate-100">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={activeTab === 'users' ? 'Search by name or email...' : 'Search staff member...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:bg-white transition-all"
                />
              </div>

              {activeTab === 'cinema-assignment' && (
                <div className="flex items-center gap-3">
                  <label htmlFor="cinema-filter-select" className="text-xs font-semibold text-slate-500 whitespace-nowrap">Filter Branch:</label>
                  <select
                    id="cinema-filter-select"
                    value={cinemaFilter}
                    onChange={(e) => setCinemaFilter(e.target.value)}
                    className="text-sm bg-slate-50 border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="all">All Branches ({staffUsers.length})</option>
                    <option value="unassigned">⚠️ Unassigned Only ({unassignedStaffCount})</option>
                    {cinemas.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        📍 {c.name} ({c.city})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Table Area */}
            {activeTab === 'users' ? (
              <section className="bg-surface-container-low p-1 rounded-lg">
                <div className="bg-white overflow-hidden shadow-sm rounded-lg">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-4 text-[0.7rem] uppercase tracking-wider font-bold text-slate-500">User Details</th>
                        <th className="px-6 py-4 text-[0.7rem] uppercase tracking-wider font-bold text-slate-500">Access Level</th>
                        <th className="px-6 py-4 text-[0.7rem] uppercase tracking-wider font-bold text-slate-500">Assigned Cinema</th>
                        <th className="px-6 py-4 text-[0.7rem] uppercase tracking-wider font-bold text-slate-500">Status</th>
                        <th className="px-6 py-4 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-10 text-center text-slate-400 text-sm">
                            No users found matching your search.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((user) => {
                          const assignedCinema = user.cinemaId ? cinemaMap.get(user.cinemaId) : null;
                          return (
                            <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 bg-blue-100 text-blue-700 font-bold flex items-center justify-center rounded text-sm">
                                    {user.name.split(' ').map((part: string) => part[0]).join('')}
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                                    <p className="text-xs text-slate-500">{user.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-3 py-1 font-bold text-xs rounded-full uppercase tracking-wider ${
                                  user.roles.admin
                                    ? 'bg-purple-50 text-purple-700'
                                    : user.roles.staff
                                      ? 'bg-blue-50 text-blue-700'
                                      : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {user.roles.admin ? 'Admin' : user.roles.staff ? 'Staff' : 'Customer'}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                {user.roles.admin ? (
                                  <span className="text-xs font-semibold text-slate-400">All Cinemas (Global)</span>
                                ) : user.roles.staff ? (
                                  assignedCinema ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-semibold">
                                      <Building2 className="w-3.5 h-3.5" />
                                      {assignedCinema.name}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-md text-xs font-semibold">
                                      <AlertCircle className="w-3.5 h-3.5" />
                                      Unassigned
                                    </span>
                                  )
                                ) : (
                                  <span className="text-xs text-slate-300">—</span>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-tight ${
                                    user.status === 'active'
                                      ? 'bg-green-50 text-green-700'
                                      : 'bg-slate-100 text-slate-500'
                                  }`}
                                >
                                  {user.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center gap-2 justify-end">
                                  <button
                                    onClick={() => handleEditClick(user)}
                                    className="px-3 py-1 bg-surface-container-low text-primary text-[10px] uppercase font-bold tracking-widest rounded hover:bg-blue-50 transition-colors"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteClick(user.id)}
                                    className="px-3 py-1 text-slate-400 hover:text-error text-[10px] uppercase font-bold tracking-widest rounded transition-colors"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : (
              /* Cinema Assignment (Staff) Tab */
              <section className="bg-surface-container-low p-1 rounded-lg">
                <div className="bg-white overflow-hidden shadow-sm rounded-lg">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-4 text-[0.7rem] uppercase tracking-wider font-bold text-slate-500">Staff Member</th>
                        <th className="px-6 py-4 text-[0.7rem] uppercase tracking-wider font-bold text-slate-500">Current Scope</th>
                        <th className="px-6 py-4 text-[0.7rem] uppercase tracking-wider font-bold text-slate-500">Assigned Cinema Branch</th>
                        <th className="px-6 py-4 text-[0.7rem] uppercase tracking-wider font-bold text-slate-500">Quick Reassign</th>
                        <th className="px-6 py-4 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredStaff.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-sm">
                            No staff members match the selected filter.
                          </td>
                        </tr>
                      ) : (
                        filteredStaff.map((staff) => {
                          const currentCinema = staff.cinemaId ? cinemaMap.get(staff.cinemaId) : null;
                          return (
                            <tr key={staff.id} className="hover:bg-slate-50/50 transition-colors group">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 bg-blue-100 text-blue-700 font-bold flex items-center justify-center rounded text-sm">
                                    {staff.name.split(' ').map((p: string) => p[0]).join('')}
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">{staff.name}</p>
                                    <p className="text-xs text-slate-500">{staff.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                {currentCinema ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 rounded-md text-xs font-semibold">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Active at Branch
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-md text-xs font-semibold">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    Needs Assignment
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                {currentCinema ? (
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">{currentCinema.name}</p>
                                    <p className="text-xs text-slate-500">{currentCinema.city} • {currentCinema.address}</p>
                                  </div>
                                ) : (
                                  <span className="text-xs text-amber-600 font-medium">
                                    Not assigned (cannot verify tickets or rentals)
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <select
                                  aria-label={`Assign cinema branch for ${staff.name}`}
                                  value={staff.cinemaId === null ? '' : String(staff.cinemaId)}
                                  onChange={(e) => handleInlineCinemaChange(staff.id, staff.name, e.target.value)}
                                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-primary focus:bg-white transition-all font-medium text-slate-700"
                                >
                                  <option value="">-- Unassigned (None) --</option>
                                  {cinemas.map((c) => (
                                    <option key={c.id} value={String(c.id)}>
                                      📍 {c.name} ({c.city})
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleEditClick(staff)}
                                  className="px-3 py-1 bg-surface-container-low text-primary text-[10px] uppercase font-bold tracking-widest rounded hover:bg-blue-50 transition-colors"
                                >
                                  Full Edit
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <UserRoleModal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        onSubmit={handleRoleSubmit}
        onAssignCinema={assignStaffCinema}
        cinemas={cinemas}
        user={selectedUser}
      />
    </AdminLayout>
  );
};
