import React, { useState } from 'react';

import { AdminLayout } from '../../components/admin/AdminLayout';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { AdminTopBar } from '../../components/admin/AdminTopBar';
import { useAdminPermissions } from '../../hooks/useAdminPermissions';
import { UserRoleModal } from '../../components/admin/modals/UserRoleModal';

export const PermissionManagement: React.FC = () => {
  const { users, isLoading, updateUserRole, deleteUser } = useAdminPermissions();
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

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

  const totalUsers = users.length;
  const activeStaff = users.filter((user) => user.roles.staff).length;
  const pendingInvites = 18;
  const recentLogins = 856;

  return (
    <AdminLayout activeItemId="permissions">
      <AdminTopBar title="Admin Console" searchPlaceholder="Search users, roles, or permissions..." />
      <main className="p-6 md:p-8 space-y-8">
        <AdminPageHeader
          title="User Management"
          subtitle="Configure user roles and granular access permissions across the global network."
        // actions={
        //   <>
        //     <button className="px-4 py-2 text-sm font-semibold text-primary bg-surface-container hover:bg-surface-container-high transition-colors flex items-center gap-2">
        //       <FileDown className="w-4 h-4" />
        //       Export Data
        //     </button>
        //     <button className="px-4 py-2 text-sm font-semibold text-white bg-primary hover:opacity-90 transition-colors flex items-center gap-2">
        //       <UserPlus className="w-4 h-4" />
        //       Invite User
        //     </button>
        //   </>
        // }
        />

        {isLoading ? (
          <div className="text-center py-10 text-on-surface-variant">Loading permissions...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="bg-surface-container-lowest p-6 flex flex-col justify-between h-32">
                <span className="text-[0.7rem] uppercase tracking-widest font-semibold text-on-surface-variant">Total Users</span>
                <span className="text-4xl font-bold tracking-tight text-on-surface">{totalUsers}</span>
              </div>
              <div className="bg-surface-container-low p-6 flex flex-col justify-between h-32 border-l-4 border-blue-600">
                <span className="text-[0.7rem] uppercase tracking-widest font-semibold text-primary">Active Staff</span>
                <span className="text-4xl font-bold tracking-tight text-on-surface">{activeStaff}</span>
              </div>
              <div className="bg-surface-container-lowest p-6 flex flex-col justify-between h-32">
                <span className="text-[0.7rem] uppercase tracking-widest font-semibold text-on-surface-variant">Pending Invites</span>
                <span className="text-4xl font-bold tracking-tight text-on-surface">{pendingInvites}</span>
              </div>
              <div className="bg-surface-container-lowest p-6 flex flex-col justify-between h-32">
                <span className="text-[0.7rem] uppercase tracking-widest font-semibold text-on-surface-variant">Recent Logins (24h)</span>
                <span className="text-4xl font-bold tracking-tight text-on-surface">{recentLogins}</span>
              </div>
            </div>

            <section className="bg-surface-container-low p-1 rounded-lg">
              <div className="bg-surface-container-lowest overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-outline-variant/30">
                      <th className="px-6 py-4 text-[0.7rem] uppercase tracking-wider font-bold text-on-surface-variant">User Details</th>
                      <th className="px-6 py-4 text-[0.7rem] uppercase tracking-wider font-bold text-on-surface-variant">Access Level</th>
                      <th className="px-6 py-4 text-[0.7rem] uppercase tracking-wider font-bold text-on-surface-variant">Status</th>
                      <th className="px-6 py-4 text-[0.7rem] uppercase tracking-wider font-bold text-on-surface-variant">Last Activity</th>
                      <th className="px-6 py-4 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-surface-container/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-primary-container text-primary font-bold flex items-center justify-center rounded text-sm">
                              {user.name
                                .split(' ')
                                .map((part) => part[0])
                                .join('')}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-on-surface">{user.name}</p>
                              <p className="text-xs text-on-surface-variant">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-primary-container text-primary font-bold text-xs rounded-full uppercase tracking-wider">
                            {user.roles.admin ? 'Admin' : user.roles.staff ? 'Staff' : 'Customer'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-tight ${user.status === 'active'
                              ? 'bg-success-container text-on-success-container'
                              : user.status === 'on-leave'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-surface-container text-on-surface-variant'
                              }`}
                          >
                            {user.status.replace('-', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-on-surface-variant">{user.lastActivity}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <button onClick={() => handleEditClick(user)} className="px-3 py-1 bg-surface-container-low text-primary text-[10px] uppercase font-bold tracking-widest rounded hover:bg-primary-container transition-colors">Edit</button>
                            <button onClick={() => handleDeleteClick(user.id)} className="px-3 py-1 text-on-surface-variant hover:text-error text-[10px] uppercase font-bold tracking-widest rounded transition-colors">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>

      <UserRoleModal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        onSubmit={handleRoleSubmit}
        user={selectedUser}
      />
    </AdminLayout>
  );
};
