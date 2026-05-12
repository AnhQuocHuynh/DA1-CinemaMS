import { useEffect, useState } from 'react';
import { adminService } from '../services/adminService';
import { AdminPermissionRule, AdminUserPermission } from '../types/admin';

export const useAdminPermissions = () => {
  const [users, setUsers] = useState<AdminUserPermission[]>([]);
  const [rules, setRules] = useState<AdminPermissionRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadPermissions = async () => {
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

    loadPermissions();
  }, []);

  return { users, rules, isLoading };
};
