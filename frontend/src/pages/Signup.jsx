import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AuthContext from '../contexts/AuthContext';
import { handleError } from '../utils/errorHandler';

const Signup = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'staff',
    specialty: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [signupStatus, setSignupStatus] = useState(null);
  
  const { register } = useContext(AuthContext);
  const navigate = useNavigate();

  // Check signup status on component mount
  useEffect(() => {
    checkSignupStatus();
  }, []);

  const checkSignupStatus = async () => {
    try {
      // Use public endpoint instead of protected admin endpoint
      // Using relative path to leverage Vite proxy or same-origin in production
      const response = await fetch('/api/public/signup-status');
      if (response.ok) {
        const status = await response.json();
        setSignupStatus(status);
      } else {
        // If endpoint fails, assume signups are enabled
        console.warn('Signup status check failed, defaulting to enabled');
        setSignupStatus({ is_enabled: true, message: 'Signups are currently enabled.' });
      }
    } catch (error) {
      console.error('Error checking signup status:', error);
      setSignupStatus({ is_enabled: true, message: 'Signups are currently enabled.' });
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    if (error) setError('');
    if (success) setSuccess('');
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('Name is required');
      return false;
    }
    if (!formData.email.trim()) {
      setError('Email is required');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    if (!formData.phone.trim()) {
      setError('Phone number is required');
      return false;
    }
    if (!/^\+?[\d\s\-\(\)]{10,}$/.test(formData.phone)) {
      setError('Please enter a valid phone number (at least 10 digits)');
      return false;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await register(formData);
      setSuccess('Account created successfully! Redirecting to login...');
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      const message = err.response?.data?.error || 'Registration failed. Please try again.';
      setError(message);
      handleError(err, message);
    } finally {
      setLoading(false);
    }
  };

  // If signups are disabled, show disabled message
  if (signupStatus && !signupStatus.is_enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 py-6 px-4 sm:py-12 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <div className="mx-auto h-20 w-20 flex items-center justify-center rounded-full bg-gradient-to-r from-gray-500 to-gray-600 shadow-2xl">
              <svg 
                className="h-12 w-12 text-white" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="mt-6 text-4xl font-extrabold bg-gradient-to-r from-gray-600 to-gray-700 bg-clip-text text-transparent">
              Signups Disabled
            </h1>
            <p className="mt-4 text-lg text-gray-600 font-medium">
              {signupStatus.message || 'New registrations are currently not available.'}
            </p>
          </div>

          <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-100 text-center">
            <div className="text-6xl mb-4">🔒</div>
            <p className="text-gray-600 mb-6">
              Please contact your administrator if you need access to the system.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-6 py-3 border border-transparent text-base font-bold rounded-xl text-white bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 transition-all duration-300"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 py-6 px-4 sm:py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-20 w-20 flex items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-pink-500 shadow-2xl transform hover:scale-105 transition-transform duration-300">
            <svg 
              className="h-12 w-12 text-white" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h1 className="mt-6 text-4xl font-extrabold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Join Our Team
          </h1>
          <p className="mt-2 text-lg text-gray-600 font-medium">
            Vonne X2X Management System
          </p>
        </div>

        {/* Signup Form */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-100">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Name Field */}
            <div>
              <label htmlFor="name" className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <span>👤</span>
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  className="appearance-none block w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base transition-all duration-200"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={handleChange}
                />
              </div>
            </div>
            
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <span>📧</span>
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none block w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base transition-all duration-200"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
            </div>
            
            {/* Phone Number Field */}
            <div>
              <label htmlFor="phone" className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <span>📞</span>
                Phone Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                  </svg>
                </div>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  required
                  className="appearance-none block w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base transition-all duration-200"
                  placeholder="(555) 123-4567"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>
            </div>
            
            {/* Role Field */}
            <div>
              <label htmlFor="role" className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <span>🎯</span>
                Role
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                </div>
                <select
                  id="role"
                  name="role"
                  className="appearance-none block w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base transition-all duration-200 bg-white"
                  value={formData.role}
                  onChange={handleChange}
                >
                  <option value="staff">Staff</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
            </div>
            
            {/* Specialty Field - Only show for staff/manager roles */}
            {(formData.role === 'staff' || formData.role === 'manager') && (
              <div>
                <label htmlFor="specialty" className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <span>⭐</span>
                  Specialty (Optional)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <input
                    id="specialty"
                    name="specialty"
                    type="text"
                    className="appearance-none block w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base transition-all duration-200"
                    placeholder="e.g., Hair Styling, Nail Art, Massage"
                    value={formData.specialty}
                    onChange={handleChange}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Describe your area of expertise to help with assignment decisions
                </p>
              </div>
            )}
            
            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <span>🔒</span>
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  className="appearance-none block w-full pl-12 pr-12 py-3 border-2 border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base transition-all duration-200"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                      <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            
            {/* Confirm Password Field */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <span>✅</span>
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  className="appearance-none block w-full pl-12 pr-12 py-3 border-2 border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base transition-all duration-200"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showConfirmPassword ? (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                      <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-xl bg-gradient-to-r from-red-50 to-pink-50 p-4 border-2 border-red-200 shadow-md animate-shake">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-bold text-red-800">
                      Registration Failed
                    </h3>
                    <div className="mt-1 text-sm text-red-700">
                      <p>{error}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 p-4 border-2 border-green-200 shadow-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-bold text-green-800">
                      Success!
                    </h3>
                    <div className="mt-1 text-sm text-green-700">
                      <p>{success}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent text-base font-bold rounded-xl text-white bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    <span>Create Account</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Login Link */}
          <div className="mt-6 pt-6 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-semibold text-purple-600 hover:text-purple-500 transition-colors"
              >
                Sign in here
              </Link>
            </p>
          </div>
        </div>
        
        {/* Footer */}
        <div className="text-center space-y-2">
          <p className="text-sm text-gray-600">
            © {new Date().getFullYear()} Vonne X2X. All rights reserved.
          </p>
          <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
            <a href="#" className="hover:text-purple-600 transition-colors">Privacy Policy</a>
            <span>•</span>
            <a href="#" className="hover:text-purple-600 transition-colors">Terms of Service</a>
            <span>•</span>
            <a href="#" className="hover:text-purple-600 transition-colors">Support</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;