import React, { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPut, apiPatch, API_ENDPOINTS } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

const CouponManagement = () => {
  const { hasRole } = useAuth();
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [usageHistory, setUsageHistory] = useState([]);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageStats, setUsageStats] = useState({ total: 0, limit: 50, offset: 0 });
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    discount_type: 'percentage',
    discount_value: '',
    min_order_amount: '',
    max_discount_amount: '',
    usage_limit: '',
    valid_from: '',
    valid_until: ''
  });

  const isAdmin = hasRole('admin') || hasRole('manager');

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      const response = await apiGet(API_ENDPOINTS.COUPONS);
      setCoupons(Array.isArray(response) ? response : (response.data || []));
    } catch (error) {
      console.error('Error fetching coupons:', error);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const errors = {};
    
    // Required fields validation
    if (!formData.code.trim()) errors.code = 'Coupon code is required';
    if (!formData.name.trim()) errors.name = 'Coupon name is required';
    if (!formData.discount_value || parseFloat(formData.discount_value) <= 0) {
      errors.discount_value = 'Discount value must be greater than 0';
    }
    if (!formData.valid_from) errors.valid_from = 'Valid from date is required';
    if (!formData.valid_until) errors.valid_until = 'Valid until date is required';
    
    // Date validation
    if (formData.valid_from && formData.valid_until) {
      const fromDate = new Date(formData.valid_from);
      const untilDate = new Date(formData.valid_until);
      const now = new Date();
      
      if (fromDate >= untilDate) {
        errors.valid_until = 'Valid until date must be after valid from date';
      }
      
      if (untilDate <= now) {
        errors.valid_until = 'Valid until date must be in the future';
      }
    }
    
    // Discount type specific validation
    if (formData.discount_type === 'percentage') {
      const value = parseFloat(formData.discount_value);
      if (value > 100) {
        errors.discount_value = 'Percentage discount cannot exceed 100%';
      }
    }
    
    // Usage limit validation
    if (formData.usage_limit && parseInt(formData.usage_limit) <= 0) {
      errors.usage_limit = 'Usage limit must be greater than 0';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Clear error when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      discount_type: 'percentage',
      discount_value: '',
      min_order_amount: '',
      max_discount_amount: '',
      usage_limit: '',
      valid_from: '',
      valid_until: ''
    });
    setFormErrors({});
    setEditingCoupon(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form before submission
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Format data for API
      const submitData = {
        ...formData,
        code: formData.code.toUpperCase(),
        discount_value: parseFloat(formData.discount_value),
        min_order_amount: formData.min_order_amount ? parseFloat(formData.min_order_amount) : 0,
        max_discount_amount: formData.max_discount_amount ? parseFloat(formData.max_discount_amount) : null,
        usage_limit: formData.usage_limit ? parseInt(formData.usage_limit) : null
      };
      
      if (editingCoupon) {
        await apiPut(`${API_ENDPOINTS.COUPONS}/${editingCoupon.id}`, submitData);
      } else {
        await apiPost(API_ENDPOINTS.COUPONS, submitData);
      }
      
      fetchCoupons();
      resetForm();
      alert(editingCoupon ? 'Coupon updated successfully!' : 'Coupon created successfully!');
    } catch (error) {
      console.error('Error saving coupon:', error);
      alert('Error saving coupon: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      name: coupon.name || '',
      description: coupon.description || '',
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value.toString(),
      min_order_amount: coupon.min_order_amount?.toString() || '',
      max_discount_amount: coupon.max_discount_amount?.toString() || '',
      usage_limit: coupon.usage_limit?.toString() || '',
      valid_from: coupon.valid_from ? new Date(coupon.valid_from).toISOString().slice(0, 16) : '',
      valid_until: coupon.valid_until ? new Date(coupon.valid_until).toISOString().slice(0, 16) : ''
    });
    setShowForm(true);
  };

  const handleDeactivate = async (id) => {
    if (window.confirm('Are you sure you want to deactivate this coupon?')) {
      try {
        await apiPatch(`${API_ENDPOINTS.COUPONS}/${id}/deactivate`);
        fetchCoupons();
        alert('Coupon deactivated successfully!');
      } catch (error) {
        console.error('Error deactivating coupon:', error);
        alert('Error deactivating coupon: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  const formatCurrency = (amount) => {
    const formatted = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(amount);
    
    // Remove trailing .00 decimals
    return formatted.replace(/\.00$/, '');
  };

  const fetchUsageHistory = async (couponId, page = 0) => {
    try {
      setUsageLoading(true);
      const limit = 10;
      const offset = page * limit;
      
      const params = new URLSearchParams({
        coupon_id: couponId,
        limit: limit.toString(),
        offset: offset.toString()
      });
      
      const response = await apiGet(`${API_ENDPOINTS.COUPON_USAGE_HISTORY}?${params}`);
      setUsageHistory(response.usage_history || []);
      setUsageStats({
        total: response.total || 0,
        limit: response.limit || 10,
        offset: response.offset || 0
      });
    } catch (error) {
      console.error('Error fetching usage history:', error);
      setUsageHistory([]);
    } finally {
      setUsageLoading(false);
    }
  };

  const handleViewUsage = (coupon) => {
    setSelectedCoupon(coupon);
    setShowUsageModal(true);
    fetchUsageHistory(coupon.id);
  };

  const closeUsageModal = () => {
    setShowUsageModal(false);
    setSelectedCoupon(null);
    setUsageHistory([]);
    setUsageStats({ total: 0, limit: 50, offset: 0 });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const isExpired = (coupon) => {
    return new Date(coupon.valid_until) < new Date();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64" role="status" aria-label="Loading coupons">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <span className="sr-only">Loading coupons...</span>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Coupon Management</h1>
      
      {/* Coupon Statistics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-500">Total Coupons</div>
          <div className="text-2xl font-bold text-gray-900">{coupons.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-500">Active Coupons</div>
          <div className="text-2xl font-bold text-green-600">
            {coupons.filter(c => c.is_active && new Date(c.valid_until) > new Date()).length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-500">Total Usage</div>
          <div className="text-2xl font-bold text-blue-600">
            {coupons.reduce((sum, c) => sum + (c.used_count || 0), 0)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-500">Avg Usage Rate</div>
          <div className="text-2xl font-bold text-purple-600">
            {coupons.length > 0 
              ? Math.round(
                  coupons
                    .filter(c => c.usage_limit)
                    .reduce((sum, c) => sum + ((c.used_count / c.usage_limit) * 100), 0) / 
                  coupons.filter(c => c.usage_limit).length || 1
                ) + '%'
              : '0%'
            }
          </div>
        </div>
      </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center space-x-2"
            aria-label="Create new coupon"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Create Coupon</span>
          </button>
        )}
      </div>

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="form-title">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 id="form-title" className="text-xl font-semibold">
                {editingCoupon ? 'Edit Coupon' : 'Create New Coupon'}
              </h2>
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close form"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" role="form" aria-label={editingCoupon ? 'Edit coupon form' : 'Create coupon form'}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="coupon-code" className="block text-sm font-medium text-gray-700 mb-1">
                    Coupon Code *
                  </label>
                  <input
                    id="coupon-code"
                    type="text"
                    name="code"
                    value={formData.code}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      formErrors.code ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="e.g., SAVE20"
                    required
                    aria-required="true"
                    style={{ textTransform: 'uppercase' }}
                  />
                  {formErrors.code && (
                    <p className="mt-1 text-sm text-red-600" role="alert">{formErrors.code}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="coupon-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Coupon Name *
                  </label>
                  <input
                    id="coupon-name"
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      formErrors.name ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="e.g., 20% Off Sale"
                    required
                    aria-required="true"
                  />
                  {formErrors.name && (
                    <p className="mt-1 text-sm text-red-600" role="alert">{formErrors.name}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="coupon-description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="coupon-description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder="Describe the coupon offer..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="discount-type" className="block text-sm font-medium text-gray-700 mb-1">
                    Discount Type *
                  </label>
                  <select
                    id="discount-type"
                    name="discount_type"
                    value={formData.discount_type}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    aria-required="true"
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="discount-value" className="block text-sm font-medium text-gray-700 mb-1">
                    Discount Value * {formData.discount_type === 'percentage' ? '(%)' : '(₦)'}
                  </label>
                  <input
                    id="discount-value"
                    type="number"
                    name="discount_value"
                    value={formData.discount_value}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      formErrors.discount_value ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder={formData.discount_type === 'percentage' ? '20' : '1000'}
                    min="0"
                    step={formData.discount_type === 'percentage' ? '0.01' : '1'}
                    max={formData.discount_type === 'percentage' ? '100' : undefined}
                    required
                    aria-required="true"
                  />
                  {formErrors.discount_value && (
                    <p className="mt-1 text-sm text-red-600" role="alert">{formErrors.discount_value}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="min-order" className="block text-sm font-medium text-gray-700 mb-1">
                    Minimum Order Amount (₦)
                  </label>
                  <input
                    id="min-order"
                    type="number"
                    name="min_order_amount"
                    value={formData.min_order_amount}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                    min="0"
                    step="1"
                  />
                </div>

                {formData.discount_type === 'percentage' && (
                  <div>
                    <label htmlFor="max-discount" className="block text-sm font-medium text-gray-700 mb-1">
                      Maximum Discount Amount (₦)
                    </label>
                    <input
                      id="max-discount"
                      type="number"
                      name="max_discount_amount"
                      value={formData.max_discount_amount}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="No limit"
                      min="0"
                      step="1"
                    />
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="usage-limit" className="block text-sm font-medium text-gray-700 mb-1">
                  Usage Limit
                </label>
                <input
                  id="usage-limit"
                  type="number"
                  name="usage_limit"
                  value={formData.usage_limit}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.usage_limit ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Unlimited"
                  min="1"
                />
                {formErrors.usage_limit && (
                  <p className="mt-1 text-sm text-red-600" role="alert">{formErrors.usage_limit}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="valid-from" className="block text-sm font-medium text-gray-700 mb-1">
                    Valid From *
                  </label>
                  <input
                    id="valid-from"
                    type="datetime-local"
                    name="valid_from"
                    value={formData.valid_from}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      formErrors.valid_from ? 'border-red-500' : 'border-gray-300'
                    }`}
                    required
                    aria-required="true"
                  />
                  {formErrors.valid_from && (
                    <p className="mt-1 text-sm text-red-600" role="alert">{formErrors.valid_from}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="valid-until" className="block text-sm font-medium text-gray-700 mb-1">
                    Valid Until *
                  </label>
                  <input
                    id="valid-until"
                    type="datetime-local"
                    name="valid_until"
                    value={formData.valid_until}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      formErrors.valid_until ? 'border-red-500' : 'border-gray-300'
                    }`}
                    required
                    aria-required="true"
                  />
                  {formErrors.valid_until && (
                    <p className="mt-1 text-sm text-red-600" role="alert">{formErrors.valid_until}</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4" role="group" aria-label="Form actions">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Cancel and close form"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-4 py-2 bg-blue-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                    isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'
                  }`}
                  aria-label={editingCoupon ? 'Update coupon information' : 'Create new coupon'}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {editingCoupon ? 'Updating...' : 'Creating...'}
                    </span>
                  ) : (
                    editingCoupon ? 'Update Coupon' : 'Create Coupon'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Coupons Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden" role="region" aria-label="Coupons table">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200" role="table" aria-label="Coupons list">
            <thead className="bg-gray-50">
              <tr role="row">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" role="columnheader" scope="col">
                  Code & Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" role="columnheader" scope="col">
                  Discount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" role="columnheader" scope="col">
                  Usage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" role="columnheader" scope="col">
                  Validity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" role="columnheader" scope="col">
                  Status
                </th>
                {isAdmin && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" role="columnheader" scope="col">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {coupons.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? "6" : "5"} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <svg className="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      <p className="text-lg font-medium">No coupons found</p>
                      <p className="text-sm">Create your first coupon to get started</p>
                    </div>
                  </td>
                </tr>
              ) : (
                coupons.map((coupon) => (
                  <tr key={coupon.id} className="hover:bg-gray-50" role="row">
                    <td className="px-6 py-4 whitespace-nowrap" role="cell">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{coupon.code}</div>
                        <div className="text-sm text-gray-500">{coupon.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap" role="cell">
                      <div className="text-sm text-gray-900">
                        {coupon.discount_type === 'percentage' 
                          ? `${coupon.discount_value}%` 
                          : formatCurrency(coupon.discount_value)
                        }
                      </div>
                      {coupon.min_order_amount > 0 && (
                        <div className="text-xs text-gray-500">
                          Min: {formatCurrency(coupon.min_order_amount)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap" role="cell">
                      <div className="text-sm text-gray-900">
                        {coupon.used_count} / {coupon.usage_limit || '∞'}
                      </div>
                      {coupon.usage_limit && (
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${Math.min((coupon.used_count / coupon.usage_limit) * 100, 100)}%` }}
                          ></div>
                        </div>
                      )}
                      {coupon.used_count > 0 && (
                        <button
                          onClick={() => handleViewUsage(coupon)}
                          className="text-xs text-blue-600 hover:text-blue-800 mt-1 underline"
                          title="View usage details"
                          aria-label={`View usage details for coupon ${coupon.code}`}
                        >
                          View Usage
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap" role="cell">
                      <div className="text-xs text-gray-500">
                        <div>From: {formatDate(coupon.valid_from)}</div>
                        <div>Until: {formatDate(coupon.valid_until)}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap" role="cell">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        coupon.is_active 
                          ? new Date(coupon.valid_until) > new Date()
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`} role="status" aria-label={`Coupon status: ${
                        coupon.is_active 
                          ? new Date(coupon.valid_until) > new Date()
                            ? 'Active'
                            : 'Expired'
                          : 'Inactive'
                      }`}>
                        {coupon.is_active 
                          ? new Date(coupon.valid_until) > new Date()
                            ? 'Active'
                            : 'Expired'
                          : 'Inactive'
                        }
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" role="cell">
                        <div role="group" aria-label={`Actions for coupon ${coupon.code}`}>
                          <button
                            onClick={() => handleEdit(coupon)}
                            className="text-blue-600 hover:text-blue-900 mr-2"
                            title="Edit coupon"
                            aria-label={`Edit coupon ${coupon.code}`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {coupon.is_active && (
                            <button
                              onClick={() => handleDeactivate(coupon.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Deactivate coupon"
                              aria-label={`Deactivate coupon ${coupon.code}`}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Usage History Modal */}
      {showUsageModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" role="dialog" aria-labelledby="usage-modal-title">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h2 id="usage-modal-title" className="text-xl font-bold text-gray-800">
                Coupon Usage History - {selectedCoupon?.code}
              </h2>
              <button
                onClick={closeUsageModal}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close usage history modal"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-sm text-blue-600 font-medium">Total Uses</div>
                  <div className="text-2xl font-bold text-blue-800">{selectedCoupon?.used_count || 0}</div>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="text-sm text-green-600 font-medium">Usage Limit</div>
                  <div className="text-2xl font-bold text-green-800">{selectedCoupon?.usage_limit || '∞'}</div>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg">
                  <div className="text-sm text-purple-600 font-medium">Usage Rate</div>
                  <div className="text-2xl font-bold text-purple-800">
                    {selectedCoupon?.usage_limit 
                      ? `${Math.round((selectedCoupon.used_count / selectedCoupon.usage_limit) * 100)}%`
                      : 'N/A'
                    }
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Discount Amount
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Used At
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Transaction ID
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {usageLoading ? (
                    <tr>
                      <td colSpan="4" className="px-4 py-8 text-center">
                        <div className="flex justify-center items-center">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                          <span className="ml-2 text-gray-600">Loading usage history...</span>
                        </div>
                      </td>
                    </tr>
                  ) : usageHistory.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-4 py-8 text-center text-gray-500">
                        No usage history found for this coupon.
                      </td>
                    </tr>
                  ) : (
                    usageHistory.map((usage, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {usage.customer_email || 'N/A'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(usage.discount_amount || 0)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(usage.used_at)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          {usage.transaction_id || 'N/A'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={closeUsageModal}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CouponManagement;