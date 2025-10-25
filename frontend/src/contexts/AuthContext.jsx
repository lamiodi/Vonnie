import React, { createContext, useContext, useState, useEffect } from 'react';

// Create Auth Context
const AuthContext = createContext();

// API base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';

// Auth Provider Component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('auth_token'));

  // API helper function
  const apiCall = async (endpoint, options = {}) => {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'API request failed');
    }

    return data;
  };

  // Get user profile from backend
  const getUserProfile = async () => {
    try {
      if (!token) return null;
      
      const data = await apiCall('/auth/profile');
      return data.user;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      // Clear invalid token
      localStorage.removeItem('auth_token');
      setToken(null);
      return null;
    }
  };

  // Check current session on component mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        if (token) {
          const userProfile = await getUserProfile();
          setUser(userProfile);
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Error initializing auth:', error);
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, [token]);

  // Sign up function
  const signUp = async (email, password, userData) => {
    try {
      const data = await apiCall('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          first_name: userData.first_name,
          last_name: userData.last_name,
          phone: userData.phone,
          role: userData.role || 'staff'
        }),
      });

      // Store token and update state
      localStorage.setItem('auth_token', data.token);
      setToken(data.token);
      setUser(data.user);
      
      return data;
    } catch (error) {
      throw error;
    }
  };

  // Sign in function
  const signIn = async (email, password) => {
    try {
      const data = await apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password
        }),
      });

      // Store token and update state
      localStorage.setItem('auth_token', data.token);
      setToken(data.token);
      setUser(data.user);
      
      return data;
    } catch (error) {
      throw error;
    }
  };

  // Sign out function
  const signOut = async () => {
    try {
      localStorage.removeItem('auth_token');
      setToken(null);
      setUser(null);
    } catch (error) {
      throw error;
    }
  };

  // Reset password function
  const resetPassword = async (email) => {
    try {
      // For now, we'll implement a simple password reset request
      // In a full implementation, this would send an email with a reset link
      const data = await apiCall('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      return data;
    } catch (error) {
      throw error;
    }
  };

  // Update password function
  const updatePassword = async (currentPassword, newPassword) => {
    try {
      const data = await apiCall('/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        }),
      });
      return data;
    } catch (error) {
      throw error;
    }
  };

  // Update user profile
  const updateProfile = async (updates) => {
    try {
      if (!user?.id) throw new Error('No user logged in');

      const data = await apiCall('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(updates),
      });

      setUser(data.user);
      return data;
    } catch (error) {
      throw error;
    }
  };

  // Helper functions for role checking
  const isAdmin = () => user?.role === 'admin';
  const isStaff = () => user?.role === 'staff';
  const hasRole = (role) => user?.role === role;
  const hasAnyRole = (roles) => roles.includes(user?.role);
  const isAuthenticated = !!user;

  const value = {
    user,
    isLoading,
    token,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    updateProfile,
    getUserProfile,
    isAdmin,
    isStaff,
    hasRole,
    hasAnyRole,
    isAuthenticated,
    profile: user // Alias for compatibility
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;