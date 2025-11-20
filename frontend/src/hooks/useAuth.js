/**
 * Custom hook for authentication and user management
 * Handles user role, permissions, and auth state
 */

import { useState, useEffect, useCallback } from 'react';

export const useAuth = () => {
  const [userRole, setUserRole] = useState('');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Get user data from localStorage
  const getUserData = useCallback(() => {
    try {
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      const token = localStorage.getItem('token');
      
      if (token && userData) {
        setUser(userData);
        setUserRole(userData.role || 'staff');
      } else {
        setUser(null);
        setUserRole('');
      }
    } catch (error) {
      console.error('Error parsing user data:', error);
      setUser(null);
      setUserRole('');
    }
  }, []);

  // Check if user has specific role
  const hasRole = useCallback((roles) => {
    if (!userRole) return false;
    if (Array.isArray(roles)) {
      return roles.includes(userRole);
    }
    return userRole === roles;
  }, [userRole]);

  // Check if user is admin or manager
  const isManager = useCallback(() => {
    return hasRole(['admin', 'manager']);
  }, [hasRole]);

  // Check if user is staff
  const isStaff = useCallback(() => {
    return userRole === 'staff';
  }, [userRole]);

  // Initialize auth data
  useEffect(() => {
    getUserData();
    setLoading(false);
  }, [getUserData]);

  return {
    user,
    userRole,
    loading,
    hasRole,
    isManager,
    isStaff,
    refreshUser: getUserData
  };
};