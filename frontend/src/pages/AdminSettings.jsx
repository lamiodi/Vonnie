import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getAdminSettings, updateAdminSettings } from '../utils/api';
import toast from 'react-hot-toast';

const AdminSettings = () => {
  const { user, hasRole } = useAuth();
  const [settings, setSettings] = useState({
    enable_online_booking: true,
    enable_email_notifications: true,
    enable_maintenance_mode: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await getAdminSettings();
      setSettings(data);
    } catch (error) {
      console.error('Error fetching admin settings:', error);
      toast.error('Failed to load admin settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await updateAdminSettings(settings);
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving admin settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Check if user is admin
  if (!hasRole('admin')) {
    return (
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h3 className="text-lg font-medium text-red-800 mb-2">Access Denied</h3>
          <p className="text-red-700 mb-4">
            Admin settings are only accessible to administrators.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Settings</h1>
        
        <form onSubmit={handleSave} className="space-y-6">
          {/* Feature Toggles */}
          <div className="pb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">System Settings</h2>
            
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="enable_online_booking"
                  name="enable_online_booking"
                  checked={settings.enable_online_booking}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="enable_online_booking" className="ml-3 block text-sm font-medium text-gray-700">
                  Enable Online Bookings
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="enable_email_notifications"
                  name="enable_email_notifications"
                  checked={settings.enable_email_notifications}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="enable_email_notifications" className="ml-3 block text-sm font-medium text-gray-700">
                  Enable Email Notifications
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="enable_maintenance_mode"
                  name="enable_maintenance_mode"
                  checked={settings.enable_maintenance_mode}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                />
                <label htmlFor="enable_maintenance_mode" className="ml-3 block text-sm font-medium text-gray-700">
                  Enable Maintenance Mode
                </label>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminSettings;