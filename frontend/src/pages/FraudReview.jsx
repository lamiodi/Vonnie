import React, { useState, useEffect, useCallback } from 'react';
import { apiGet, API_ENDPOINTS } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import toast, { Toaster } from 'react-hot-toast';

const FraudReview = () => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('alerts');
  const [expandedAlert, setExpandedAlert] = useState(null);
  const [summary, setSummary] = useState({ totalAlerts: 0, highSeverity: 0, mediumSeverity: 0 });

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet(API_ENDPOINTS.FRAUD_ALERTS);
      setAlerts(data.alerts || []);
      setSummary({
        totalAlerts: data.totalAlerts || 0,
        highSeverity: data.highSeverity || 0,
        mediumSeverity: data.mediumSeverity || 0
      });
    } catch (error) {
      toast.error('Failed to load fraud alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet(`${API_ENDPOINTS.AUDIT_LOGS}?limit=100&action=refund,void,delete,cancel`);
      setAuditLogs(Array.isArray(data) ? data : (data.audit_logs || data.data || []));
    } catch (error) {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'alerts') fetchAlerts();
    else fetchAuditLogs();
  }, [activeTab, fetchAlerts, fetchAuditLogs]);

  const getAlertIcon = (type) => {
    switch (type) {
      case 'duplicate_payment_reference': return '💳';
      case 'high_cash_expense_no_receipt': return '💰';
      case 'unusual_expense_amount': return '📊';
      case 'frequent_cancellations': return '🔄';
      case 'potential_double_refund': return '↩️';
      default: return '⚠️';
    }
  };

  const getAlertTitle = (type) => {
    switch (type) {
      case 'duplicate_payment_reference': return 'Duplicate Payment References';
      case 'high_cash_expense_no_receipt': return 'High Cash Expenses Without Receipt';
      case 'unusual_expense_amount': return 'Unusual Expense Amounts';
      case 'frequent_cancellations': return 'Frequent Cancellations';
      case 'potential_double_refund': return 'Potential Double Refunds';
      default: return 'Suspicious Activity';
    }
  };

  const getActionBadge = (action) => {
    const colors = {
      refund: 'bg-orange-100 text-orange-700',
      void: 'bg-red-100 text-red-700',
      delete: 'bg-red-100 text-red-700',
      cancel: 'bg-yellow-100 text-yellow-700',
      login: 'bg-blue-100 text-blue-700',
      create: 'bg-green-100 text-green-700',
      update: 'bg-purple-100 text-purple-700',
    };
    return colors[action] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-full">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">🛡️ Fraud Review & Suspicious Activity</h1>
        <p className="text-gray-500 mt-1 text-sm">Monitor and review potentially suspicious activities across the system</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <span className="text-red-600 text-lg">🚨</span>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{summary.totalAlerts}</div>
              <div className="text-xs text-gray-500">Total Alerts</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <span className="text-red-600 text-lg">🔴</span>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{summary.highSeverity}</div>
              <div className="text-xs text-gray-500">High Severity</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
              <span className="text-yellow-600 text-lg">🟡</span>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">{summary.mediumSeverity}</div>
              <div className="text-xs text-gray-500">Medium Severity</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200 flex">
          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-4 py-3 text-sm font-medium border-b-2 ${activeTab === 'alerts' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            🚨 Fraud Alerts ({alerts.length})
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-3 text-sm font-medium border-b-2 ${activeTab === 'audit' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            📋 Audit Log
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
            </div>
          ) : activeTab === 'alerts' ? (
            alerts.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">✅</div>
                <p className="text-gray-600 font-medium">No suspicious activity detected</p>
                <p className="text-gray-400 text-sm mt-1">All systems operating normally</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert, idx) => (
                  <div key={idx} className={`border rounded-lg overflow-hidden ${alert.severity === 'high' ? 'border-red-200' : 'border-yellow-200'}`}>
                    <button
                      onClick={() => setExpandedAlert(expandedAlert === idx ? null : idx)}
                      className={`w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition ${alert.severity === 'high' ? 'bg-red-50' : 'bg-yellow-50'}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{getAlertIcon(alert.type)}</span>
                        <div>
                          <div className="font-semibold text-gray-900">{getAlertTitle(alert.type)}</div>
                          <div className="text-sm text-gray-600">{alert.message}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${alert.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {alert.severity}
                        </span>
                        <svg className={`w-5 h-5 text-gray-400 transition-transform ${expandedAlert === idx ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>
                    {expandedAlert === idx && alert.data && (
                      <div className="border-t border-gray-200 bg-white p-4">
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                {Object.keys(alert.data[0] || {}).map(key => (
                                  <th key={key} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{key.replace(/_/g, ' ')}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {alert.data.map((row, rowIdx) => (
                                <tr key={rowIdx} className="border-b border-gray-100 hover:bg-gray-50">
                                  {Object.values(row).map((val, valIdx) => (
                                    <td key={valIdx} className="px-3 py-2 text-gray-700 max-w-xs truncate">
                                      {typeof val === 'object' ? JSON.stringify(val) : String(val ?? '-')}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) ) : (
              /* Audit Log Tab */
              auditLogs.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">📋</div>
                  <p className="text-gray-600">No audit log entries found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {auditLogs.map(log => (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{log.user_name || 'System'}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getActionBadge(log.action)}`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{log.entity_type}</td>
                          <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                            {log.details ? (typeof log.details === 'string' ? log.details : JSON.stringify(log.details)).substring(0, 100) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
        </div>
      </div>
    </div>
  );
};

export default FraudReview;
