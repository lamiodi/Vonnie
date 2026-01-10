import React, { useState, useEffect } from 'react';
import { apiGet, apiPut } from '../utils/api';
import { handleError } from '../utils/errorHandler';
import { toast } from 'react-hot-toast';

const AdminSettings = () => {
  const [settings, setSettings] = useState({
    enableOnlineBooking: true,
    enableEmailNotifications: true,
    maintenanceMode: false
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await apiGet('/admin/settings');
      // Filter to only include the settings we want to display
      setSettings({
        enableOnlineBooking: response.enableOnlineBooking || response.enable_online_booking || true,
        enableEmailNotifications: response.enableEmailNotifications || response.enable_email_notifications || true,
        maintenanceMode: response.maintenanceMode || response.maintenance_mode || false
      });
    } catch (error) {
      console.error('Error fetching settings:', error);
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      // Only save the settings we want to manage
      const filteredSettings = {
        enable_online_booking: settings.enableOnlineBooking,
        enable_email_notifications: settings.enableEmailNotifications,
        maintenance_mode: settings.maintenanceMode
      };
      await apiPut('/admin/settings', filteredSettings);
      toast.success('Settings updated successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      handleError(error);
      toast.error('Failed to update settings');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">System Settings</h2>
        <p className="text-gray-600 mt-1">Manage core system functionality</p>
      </div>

      <div className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              name="enableOnlineBooking"
              checked={settings.enableOnlineBooking}
              onChange={handleInputChange}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label className="ml-2 block text-sm text-gray-900">
              Enable Online Bookings
            </label>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              name="enableEmailNotifications"
              checked={settings.enableEmailNotifications}
              onChange={handleInputChange}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label className="ml-2 block text-sm text-gray-900">
              Enable Email Notifications
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              name="maintenanceMode"
              checked={settings.maintenanceMode}
              onChange={handleInputChange}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label className="ml-2 block text-sm text-gray-900">
              Enable Maintenance Mode
            </label>
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};

export default AdminSettings;