import { useEffect, useState } from 'react';
import { adminService } from '../services/adminService';
import { cinemaService, CinemaResponse } from '../services/cinemaService';
import { AdminPermissionRule, AdminUserPermission } from '../types/admin';

export const useAdminPermissions = () => {
  const [users, setUsers] = useState<AdminUserPermission[]>([]);
  const [rules, setRules] = useState<AdminPermissionRule[]>([]);
  const [cinemas, setCinemas] = useState<CinemaResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadPermissions = async () => {
    setIsLoading(true);
    try {
      const [userData, ruleData, cinemaData] = await Promise.all([
        adminService.getUserPermissions(),
        adminService.getPermissionRules(),
        cinemaService.getCinemas().catch((err) => {
          console.warn('Failed to load cinemas:', err);
          return [];
        }),
      ]);
      setUsers(userData);
      setRules(ruleData);
      setCinemas(cinemaData);
    } catch (error) {
      console.error('Failed to load permission data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPermissions();
  }, []);

  /**
   * Derives the single role name from the boolean roles map and calls the
   * real backend endpoint PUT /api/users/{id}/role.
   */
  const updateUserRole = async (id: string | number, data: { roles: Record<string, boolean> }) => {
    const newRole =
      Object.entries(data.roles).find(([, v]) => v)?.[0]?.toUpperCase() ?? 'CUSTOMER';
    await adminService.updateUserRole(id, newRole);
    await loadPermissions();
  };

  /**
   * Assigns a staff member to a cinema branch.
   */
  const assignStaffCinema = async (id: string | number, cinemaId: number | null) => {
    await adminService.assignStaffCinema(id, cinemaId);
    await loadPermissions();
  };

  /**
   * @todo NOT IMPLEMENTED — see adminService.deleteUser for details.
   */
  const deleteUser = async (id: string | number) => {
    await adminService.deleteUser(id);
    await loadPermissions();
  };

  return { users, rules, cinemas, isLoading, refetchUsers: loadPermissions, updateUserRole, assignStaffCinema, deleteUser };
};
