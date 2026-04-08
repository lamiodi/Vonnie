import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../utils/api';

const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // Extract token from URL query params
  const searchParams = new URLSearchParams(location.search);
  const token = searchParams.get('token');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      setError('Invalid or missing reset token.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.post('/api/auth/reset-password', { token, newPassword });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Invalid Link</h2>
          <p className="text-gray-600 mb-6">The password reset link is invalid or missing.</p>
          <button onClick={() => navigate('/login')} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-medium">
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 py-6 px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-2xl border border-gray-100">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Reset Password
          </h2>
          <p className="text-gray-500 mt-2">Create a new password for your account</p>
        </div>

        {success ? (
          <div className="text-center">
            <div className="text-green-500 text-5xl mb-4">✓</div>
            <p className="text-lg font-medium text-gray-800">Password reset successful!</p>
            <p className="text-sm text-gray-500 mt-2">Redirecting to login...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">New Password</label>
              <input
                type="password"
                required
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Confirm Password</label>
              <input
                type="password"
                required
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl hover:from-purple-600 hover:to-pink-600 focus:ring-2 focus:ring-purple-500 disabled:opacity-50 transition-all shadow-lg"
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;