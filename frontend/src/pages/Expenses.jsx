import React, { useState, useEffect, useContext } from 'react';
import AuthContext from '../contexts/AuthContext';
import { apiGet, apiPost, apiPut, apiDelete, API_ENDPOINTS } from '../utils/api';
import { handleError } from '../utils/errorHandler';
import toast, { Toaster } from 'react-hot-toast';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { queueExpense, queueExpenseEdit, getPendingExpenses } from '../services/offlineStore';

const CATEGORIES = [
  { value: 'rent', label: 'Rent', emoji: '🏠' },
  { value: 'electricity', label: 'Electricity', emoji: '⚡' },
  { value: 'diesel', label: 'Diesel/Fuel', emoji: '⛽' },
  { value: 'internet', label: 'Internet', emoji: '🌐' },
  { value: 'product_purchase', label: 'Product Purchase', emoji: '📦' },
  { value: 'maintenance', label: 'Maintenance', emoji: '🔧' },
  { value: 'logistics', label: 'Logistics', emoji: '🚚' },
  { value: 'marketing', label: 'Marketing', emoji: '📢' },
  { value: 'petty_cash', label: 'Petty Cash', emoji: '💵' },
  { value: 'staff_welfare', label: 'Staff Welfare', emoji: '👥' },
  { value: 'refund_or_loss', label: 'Refund/Loss', emoji: '↩️' },
  { value: 'miscellaneous', label: 'Miscellaneous', emoji: '📋' }
];

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'paystack', label: 'Paystack' }
];

const Expenses = () => {
  const { user } = useContext(AuthContext);
  const { isOnline } = useNetworkStatus();
  const [expenses, setExpenses] = useState([]);
  const [pendingOfflineExpenses, setPendingOfflineExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [filters, setFilters] = useState({
    start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    category: '',
    payment_method: ''
  });
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    category: '',
    payment_method: '',
    supplier: '',
    description: '',
    receipt_reference: ''
  });

  useEffect(() => {
    fetchExpenses();
    fetchSummary();
    loadPendingOfflineExpenses();
  }, [filters]);

  const loadPendingOfflineExpenses = async () => {
    try {
      const pending = await getPendingOfflineExpenses();
      setPendingOfflineExpenses(pending);
    } catch (e) {
      console.error('Error loading pending offline expenses:', e);
    }
  };

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const params = {
        start_date: filters.start_date,
        end_date: filters.end_date,
        ...(filters.category && { category: filters.category }),
        ...(filters.payment_method && { payment_method: filters.payment_method })
      };
      const response = await apiGet(API_ENDPOINTS.EXPENSES, params);
      setExpenses(response.data?.expenses || response.expenses || []);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      // Don't show error toast if it's a 404 (table might not exist yet)
      if (error.status !== 404) {
        handleError(error, 'Failed to load expenses');
      }
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await apiGet(API_ENDPOINTS.EXPENSES_SUMMARY, {
        start_date: filters.start_date,
        end_date: filters.end_date
      });
      setSummary(response.data || response);
    } catch (error) {
      console.warn('Expense summary not available:', error.message);
      setSummary(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.amount || !formData.category || !formData.payment_method) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      if (editingExpense) {
        if (isOnline) {
          await apiPut(`${API_ENDPOINTS.EXPENSES}/${editingExpense.id}`, formData);
          toast.success('Expense updated successfully');
        } else {
          // Offline: queue the edit for sync
          await queueExpenseEdit(editingExpense.id, {
            date: formData.date,
            amount: parseFloat(formData.amount),
            category: formData.category,
            paymentMethod: formData.payment_method,
            supplier: formData.supplier,
            description: formData.description,
            receiptReference: formData.receipt_reference
          });
          toast.success('Edit saved offline — will sync when online');
          loadPendingOfflineExpenses();
        }
      } else {
        if (isOnline) {
          await apiPost(API_ENDPOINTS.EXPENSES, formData);
          toast.success('Expense added successfully');
        } else {
          // Offline: queue for sync
          await queueExpense({
            date: formData.date,
            amount: parseFloat(formData.amount),
            category: formData.category,
            paymentMethod: formData.payment_method,
            supplier: formData.supplier,
            description: formData.description,
            receiptReference: formData.receipt_reference
          });
          toast.success('Expense saved offline — will sync when online');
          loadPendingOfflineExpenses();
        }
      }

      setShowForm(false);
      setEditingExpense(null);
      resetForm();
      fetchExpenses();
      fetchSummary();
    } catch (error) {
      const msg = error.error?.message || error.message || 'Failed to save expense';
      toast.error(msg);
    }
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setFormData({
      date: expense.date,
      amount: expense.amount,
      category: expense.category,
      payment_method: expense.payment_method,
      supplier: expense.supplier || '',
      description: expense.description || '',
      receipt_reference: expense.receipt_reference || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    
    try {
      await apiDelete(`${API_ENDPOINTS.EXPENSES}/${id}`);
      toast.success('Expense deleted successfully');
      fetchExpenses();
      fetchSummary();
    } catch (error) {
      toast.error('Failed to delete expense');
    }
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      amount: '',
      category: '',
      payment_method: '',
      supplier: '',
      description: '',
      receipt_reference: ''
    });
  };

  const formatCurrency = (amount) => {
    if (!amount) return '₦0';
    const formatted = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(amount);
    return formatted.replace(/\.00$/, '');
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getCategoryLabel = (value) => {
    const cat = CATEGORIES.find(c => c.value === value);
    return cat ? `${cat.emoji} ${cat.label}` : value;
  };

  const getCategoryColor = (category) => {
    const colors = {
      rent: 'bg-blue-100 text-blue-800',
      electricity: 'bg-yellow-100 text-yellow-800',
      diesel: 'bg-orange-100 text-orange-800',
      internet: 'bg-purple-100 text-purple-800',
      product_purchase: 'bg-green-100 text-green-800',
      maintenance: 'bg-red-100 text-red-800',
      logistics: 'bg-indigo-100 text-indigo-800',
      marketing: 'bg-pink-100 text-pink-800',
      petty_cash: 'bg-gray-100 text-gray-800',
      staff_welfare: 'bg-teal-100 text-teal-800',
      refund_or_loss: 'bg-rose-100 text-rose-800',
      miscellaneous: 'bg-slate-100 text-slate-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

  return (
    <div className="p-4 md:p-6">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Expenses</h1>
          <p className="text-gray-500 text-sm mt-1">Track daily shop running costs</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingExpense(null); resetForm(); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Expense
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="text-sm font-medium text-gray-500">Total Expenses</div>
            <div className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(summary.total)}</div>
            <div className="text-xs text-gray-400 mt-1">{summary.count} expense record(s)</div>
          </div>
          {summary.byCategory && summary.byCategory.slice(0, 2).map((cat, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="text-sm font-medium text-gray-500">{getCategoryLabel(cat.category)}</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(cat.total)}</div>
              <div className="text-xs text-gray-400 mt-1">{cat.count} record(s)</div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Stats (from local data) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4 border border-red-200">
          <div className="text-xs font-medium text-red-600">Total ({expenses.length})</div>
          <div className="text-lg font-bold text-red-700 mt-1">{formatCurrency(totalExpenses)}</div>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
          <div className="text-xs font-medium text-blue-600">This Month</div>
          <div className="text-lg font-bold text-blue-700 mt-1">
            {formatCurrency(totalExpenses)}
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
          <div className="text-xs font-medium text-green-600">Cash Expenses</div>
          <div className="text-lg font-bold text-green-700 mt-1">
            {formatCurrency(expenses.filter(e => e.payment_method === 'cash').reduce((s, e) => s + parseFloat(e.amount), 0))}
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
          <div className="text-xs font-medium text-purple-600">Non-Cash</div>
          <div className="text-lg font-bold text-purple-700 mt-1">
            {formatCurrency(expenses.filter(e => e.payment_method !== 'cash').reduce((s, e) => s + parseFloat(e.amount), 0))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters(prev => ({ ...prev, start_date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters(prev => ({ ...prev, end_date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.emoji} {cat.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <select
              value={filters.payment_method}
              onChange={(e) => setFilters(prev => ({ ...prev, payment_method: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Methods</option>
              {PAYMENT_METHODS.map(pm => (
                <option key={pm.value} value={pm.value}>{pm.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingExpense ? 'Edit Expense' : 'Add New Expense'}
              </h2>
              <button
                onClick={() => { setShowForm(false); setEditingExpense(null); }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₦) *</label>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    required
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select category</option>
                    {CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.emoji} {cat.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method *</label>
                  <select
                    value={formData.payment_method}
                    onChange={(e) => setFormData(prev => ({ ...prev, payment_method: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select method</option>
                    {PAYMENT_METHODS.map(pm => (
                      <option key={pm.value} value={pm.value}>{pm.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier / Vendor</label>
                <input
                  type="text"
                  value={formData.supplier}
                  onChange={(e) => setFormData(prev => ({ ...prev, supplier: e.target.value }))}
                  placeholder="e.g. ABC Suppliers"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="What was this expense for?"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Reference</label>
                <input
                  type="text"
                  value={formData.receipt_reference}
                  onChange={(e) => setFormData(prev => ({ ...prev, receipt_reference: e.target.value }))}
                  placeholder="Receipt number or reference"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingExpense(null); }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingExpense ? 'Update Expense' : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pending Offline Expenses */}
      {pendingOfflineExpenses.length > 0 && (
        <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-yellow-600 text-lg">⏳</span>
            <h3 className="text-sm font-semibold text-yellow-800">
              {pendingOfflineExpenses.length} Expense{pendingOfflineExpenses.length !== 1 ? 's' : ''} Pending Sync
            </h3>
            <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded-full">Offline</span>
          </div>
          <div className="space-y-2">
            {pendingOfflineExpenses.map((exp) => (
              <div key={exp.localId} className="flex items-center justify-between bg-white rounded-lg p-3 border border-yellow-100">
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {getCategoryLabel(exp.category)} — {formatCurrency(exp.amount)}
                  </div>
                  <div className="text-xs text-gray-500">{exp.date} • {exp.paymentMethod}</div>
                </div>
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">
                  Pending
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expenses List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Expense Records</h3>
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : expenses.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No expenses found</h3>
            <p className="mt-1 text-sm text-gray-500">Start by adding your first expense record.</p>
            <button
              onClick={() => { setShowForm(true); setEditingExpense(null); resetForm(); }}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Add First Expense
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recorded By</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(expense.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCategoryColor(expense.category)}`}>
                        {getCategoryLabel(expense.category)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                      {expense.description || expense.supplier || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {PAYMENT_METHODS.find(p => p.value === expense.payment_method)?.label || expense.payment_method}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {formatCurrency(expense.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {expense.recorded_by_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(expense)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Edit
                        </button>
                        {user?.role === 'admin' && (
                          <button
                            onClick={() => handleDelete(expense.id)}
                            className="text-red-600 hover:text-red-800 font-medium"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Expenses;
