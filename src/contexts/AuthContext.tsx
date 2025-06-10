'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, AuthTokens, LoginCredentials, RegisterCredentials } from '@/types';
import { authAPI, setTokens, clearTokens, getAccessToken } from '@/lib/api';
import socketManager from '@/lib/socket';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<boolean>;
  register: (credentials: RegisterCredentials) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (data: { username?: string; bio?: string; avatar?: string }) => Promise<boolean>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const isAuthenticated = !!user;

  // Initialize auth state on mount
  useEffect(() => {
    initializeAuth();
  }, []);

  // Connect socket when user is authenticated
  useEffect(() => {
    if (user && getAccessToken()) {
      socketManager.connect();
    } else {
      socketManager.disconnect();
    }
  }, [user]);

  const initializeAuth = async () => {
    try {
      const token = getAccessToken();
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await authAPI.getProfile();
      if (response.success && response.data) {
        setUser(response.data.user);
      } else {
        // Invalid token, clear it
        clearTokens();
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      clearTokens();
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    try {
      setLoading(true);
      const response = await authAPI.login(credentials);

      if (response.success && response.data) {
        const { user: userData, accessToken, refreshToken } = response.data;
        
        setTokens(accessToken, refreshToken);
        setUser(userData);
        
        toast.success('Welcome back!');
        return true;
      } else {
        toast.error(response.message || 'Login failed');
        return false;
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.message || 'Login failed');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const register = async (credentials: RegisterCredentials): Promise<boolean> => {
    try {
      setLoading(true);
      const response = await authAPI.register(credentials);

      if (response.success && response.data) {
        const { user: userData, accessToken, refreshToken } = response.data;
        
        setTokens(accessToken, refreshToken);
        setUser(userData);
        
        toast.success('Account created successfully!');
        return true;
      } else {
        if (response.errors && response.errors.length > 0) {
          response.errors.forEach(error => {
            toast.error(error.message);
          });
        } else {
          toast.error(response.message || 'Registration failed');
        }
        return false;
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error(error.message || 'Registration failed');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      setLoading(true);
      
      // Call logout API to update user status
      await authAPI.logout();
      
      // Disconnect socket
      socketManager.disconnect();
      
      // Clear tokens and user state
      clearTokens();
      setUser(null);
      
      toast.success('Logged out successfully');
    } catch (error: any) {
      console.error('Logout error:', error);
      // Still clear local state even if API call fails
      clearTokens();
      setUser(null);
      socketManager.disconnect();
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (data: {
    username?: string;
    bio?: string;
    avatar?: string;
  }): Promise<boolean> => {
    try {
      const response = await authAPI.updateProfile(data);

      if (response.success && response.data) {
        setUser(response.data.user);
        toast.success('Profile updated successfully');
        return true;
      } else {
        if (response.errors && response.errors.length > 0) {
          response.errors.forEach(error => {
            toast.error(error.message);
          });
        } else {
          toast.error(response.message || 'Profile update failed');
        }
        return false;
      }
    } catch (error: any) {
      console.error('Profile update error:', error);
      toast.error(error.message || 'Profile update failed');
      return false;
    }
  };

  const refreshUser = async (): Promise<void> => {
    try {
      const response = await authAPI.getProfile();
      if (response.success && response.data) {
        setUser(response.data.user);
      }
    } catch (error) {
      console.error('Refresh user error:', error);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated,
    login,
    register,
    logout,
    updateProfile,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;

