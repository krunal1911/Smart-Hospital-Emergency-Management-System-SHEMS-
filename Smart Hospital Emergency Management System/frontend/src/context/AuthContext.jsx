import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user session on initial render
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('shems_token');
      if (token) {
        try {
          const res = await api.get('/api/auth/me');
          setUser(res.data.user);
          setProfile(res.data.profile);
        } catch (err) {
          console.error('Session restoration failed:', err);
          logout();
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await api.post('/api/auth/login', { email, password });
      const { token, user: userData } = res.data;
      
      localStorage.setItem('shems_token', token);
      localStorage.setItem('shems_user', JSON.stringify(userData));
      setUser(userData);
      
      // Fetch full profile info
      const meRes = await api.get('/api/auth/me');
      setProfile(meRes.data.profile);
      
      setLoading(false);
      return { success: true, user: userData };
    } catch (err) {
      setLoading(false);
      const errMsg = err.response?.data?.message || 'Login failed. Please check credentials.';
      return { success: false, message: errMsg };
    }
  };

  const register = async (regData) => {
    setLoading(true);
    try {
      const res = await api.post('/api/auth/register', regData);
      const { token, user: userData } = res.data;

      localStorage.setItem('shems_token', token);
      localStorage.setItem('shems_user', JSON.stringify(userData));
      setUser(userData);

      // Fetch full profile info
      const meRes = await api.get('/api/auth/me');
      setProfile(meRes.data.profile);

      setLoading(false);
      return { success: true, user: userData };
    } catch (err) {
      setLoading(false);
      const errMsg = err.response?.data?.message || 'Registration failed.';
      return { success: false, message: errMsg };
    }
  };

  const logout = () => {
    localStorage.removeItem('shems_token');
    localStorage.removeItem('shems_user');
    setUser(null);
    setProfile(null);
    setLoading(false);
  };

  const refreshProfile = async () => {
    try {
      const res = await api.get('/api/auth/me');
      setUser(res.data.user);
      setProfile(res.data.profile);
    } catch (err) {
      console.error('Failed to refresh profile:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        login,
        register,
        logout,
        refreshProfile,
        setProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
export default AuthContext;
