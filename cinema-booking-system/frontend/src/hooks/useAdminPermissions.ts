import { useEffect, useState } from 'react';
import { adminService } from '../services/adminService';
import { AdminPermissionRule, AdminUserPermission } from '../types/admin';

export const useAdminPermissions = () => {
  const [users, setUsers] = useState<AdminUserPermission[]>([]);
  const [rules, setRules] = useState<AdminPermissionRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadPermissions = async () => {
    setIsLoading(true);
    try {
      const [userData, ruleData] = await Promise.all([
        adminService.getUserPermissions(),
        adminService.getPermissionRules(),
      ]);
      setUsers(userData);
      setRules(ruleData);
    } catch (error) {
      console.error('Failed to load permission data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPermissions();
  }, []);

  const updateUserRole = async (id: string | number, data: any) => {
    // Note: mock backend
    await adminService.updateUser(id, data);
    await loadPermissions();
  };

  const deleteUser = async (id: string | number) => {
    // Note: mock backend
    await adminService.deleteUser(id);
    await loadPermissions();
  };

  return { users, rules, isLoading, refetchUsers: loadPermissions, updateUserRole, deleteUser };
};
