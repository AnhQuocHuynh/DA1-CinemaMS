import React from 'react';
import { FileDown, UserPlus } from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { AdminTopBar } from '../../components/admin/AdminTopBar';
import { useAdminPermissions } from '../../hooks/useAdminPermissions';

export const PermissionManagement: React.FC = () => {
  const { users, rules, isLoading } = useAdminPermissions();

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
          actions={
            <>
              <button className="px-4 py-2 text-sm font-semibold text-primary bg-surface-container hover:bg-surface-container-high transition-colors flex items-center gap-2">
                <FileDown className="w-4 h-4" />
                Export Data
              </button>
              <button className="px-4 py-2 text-sm font-semibold text-white bg-primary hover:bg-blue-700 transition-colors flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                Invite User
              </button>
            </>
          }
        />

        {isLoading ? (
          <div className="text-center py-10 text-on-surface-variant">Loading permissions...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="bg-surface-container-lowest p-6 flex flex-col justify-between h-32">
                <span className="text-[0.7rem] uppercase tracking-widest font-semibold text-slate-400">Total Users</span>
                <span className="text-4xl font-bold tracking-tight text-slate-900">{totalUsers}</span>
              </div>
              <div className="bg-surface-container-low p-6 flex flex-col justify-between h-32 border-l-4 border-blue-600">
                <span className="text-[0.7rem] uppercase tracking-widest font-semibold text-blue-600">Active Staff</span>
                <span className="text-4xl font-bold tracking-tight text-slate-900">{activeStaff}</span>
              </div>
              <div className="bg-surface-container-lowest p-6 flex flex-col justify-between h-32">
                <span className="text-[0.7rem] uppercase tracking-widest font-semibold text-slate-400">Pending Invites</span>
                <span className="text-4xl font-bold tracking-tight text-slate-900">{pendingInvites}</span>
              </div>
              <div className="bg-surface-container-lowest p-6 flex flex-col justify-between h-32">
                <span className="text-[0.7rem] uppercase tracking-widest font-semibold text-slate-400">Recent Logins (24h)</span>
                <span className="text-4xl font-bold tracking-tight text-slate-900">{recentLogins}</span>
              </div>
            </div>

            <section className="bg-surface-container-low p-1 rounded-lg">
              <div className="bg-white overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[0.7rem] uppercase tracking-wider font-bold text-slate-500">User Details</th>
                      <th className="px-6 py-4 text-[0.7rem] uppercase tracking-wider font-bold text-slate-500">Access Level</th>
                      <th className="px-6 py-4 text-[0.7rem] uppercase tracking-wider font-bold text-slate-500">Status</th>
                      <th className="px-6 py-4 text-[0.7rem] uppercase tracking-wider font-bold text-slate-500">Last Activity</th>
                      <th className="px-6 py-4 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-blue-100 text-blue-700 font-bold flex items-center justify-center rounded text-sm">
                              {user.name
                                .split(' ')
                                .map((part) => part[0])
                                .join('')}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                              <p className="text-xs text-slate-500">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-6">
                            {(
                              [
                                { label: 'Customer', enabled: user.roles.customer },
                                { label: 'Staff', enabled: user.roles.staff },
                                { label: 'Admin', enabled: user.roles.admin },
                              ] as const
                            ).map((role) => (
                              <div key={role.label} className="flex flex-col items-center gap-1">
                                <span className="text-[10px] text-slate-400 font-medium">{role.label}</span>
                                <div
                                  className={`w-8 h-4 rounded-full relative ${
                                    role.enabled ? 'bg-blue-600' : 'bg-slate-200'
                                  }`}
                                >
                                  <div
                                    className={`absolute top-0.5 w-3 h-3 bg-white rounded-full ${
                                      role.enabled ? 'right-0.5' : 'left-0.5'
                                    }`}
                                  ></div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-tight ${
                              user.status === 'active'
                                ? 'bg-green-50 text-green-700'
                                : user.status === 'on-leave'
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {user.status.replace('-', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">{user.lastActivity}</td>
                        <td className="px-6 py-4 text-right">
                          <button className="text-slate-400 hover:text-primary transition-colors">•••</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="bg-white px-6 py-4 flex items-center justify-between mt-0.5">
                  <p className="text-xs text-slate-500">Showing {users.length} of 1,284 users</p>
                  <div className="flex gap-2">
                    <button className="w-8 h-8 rounded text-xs font-bold bg-blue-600 text-white">1</button>
                    <button className="w-8 h-8 rounded text-xs font-bold hover:bg-slate-100 text-slate-600">2</button>
                    <button className="w-8 h-8 rounded text-xs font-bold hover:bg-slate-100 text-slate-600">3</button>
                  </div>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-surface-container-low p-8 rounded-lg space-y-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 border-b border-slate-200 pb-4">
                  Global Role Permissions
                </h3>
                <div className="space-y-4">
                  {rules.map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between p-4 bg-white rounded border border-slate-50">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{rule.title}</p>
                        <p className="text-xs text-slate-500">{rule.description}</p>
                      </div>
                      <div className="flex gap-3">
                        {rule.tags.map((tag) => (
                          <span
                            key={tag}
                            className={`px-2 py-1 text-[10px] font-bold uppercase rounded ${
                              tag === 'Admin Only' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-surface-container-highest p-8 rounded-lg space-y-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">System Integrity</h3>
                <div className="space-y-6">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Two-Factor Required</p>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      2FA is mandatory for all Staff and Admin accounts.
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Automatic Session Expiry</p>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Admin sessions expire after 15 minutes of inactivity.
                    </p>
                  </div>
                  <div className="pt-6 border-t border-slate-200">
                    <button className="w-full py-2 bg-white text-slate-900 border border-slate-200 text-sm font-bold rounded hover:bg-slate-50 transition-colors">
                      Review Security Logs
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </AdminLayout>
  );
};
