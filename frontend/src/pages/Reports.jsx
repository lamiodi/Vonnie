import React, { useState, useEffect } from 'react';
import { apiGet, API_ENDPOINTS } from '../utils/api';
import { handleError, handleSuccess } from '../utils/errorHandler';

const Reports = () => {
  const [reportType, setReportType] = useState('sales');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [groupBy, setGroupBy] = useState('daily');

  useEffect(() => {
    fetchReport();
  }, [reportType, dateRange, groupBy]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = {
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
        period: groupBy
      };

      let endpoint;
      switch (reportType) {
        case 'sales':
          endpoint = API_ENDPOINTS.REPORTS_SALES;
          break;
        case 'inventory':
          endpoint = API_ENDPOINTS.REPORTS_INVENTORY;
          break;
        case 'bookings':
          endpoint = API_ENDPOINTS.REPORTS_BOOKINGS;
          break;
        case 'coupons':
          endpoint = API_ENDPOINTS.REPORTS_COUPONS;
          break;
        default:
          endpoint = API_ENDPOINTS.REPORTS_SALES;
      }

      const response = await apiGet(endpoint, params);
      setReportData(response.data || response);
    } catch (error) {
      handleError('Failed to load report data', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    // Handle null, undefined, or invalid amounts
    if (amount === null || amount === undefined || isNaN(amount) || amount === '') {
      return '₦0';
    }
    
    // Convert to number and handle edge cases
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) {
      return '₦0';
    }
    
    const formatted = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(numAmount);
    
    // Remove trailing .00 decimals
    return formatted.replace(/\.00$/, '');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Invalid Date';
    
    // Handle yearly format first (YYYY - 4 digits)
    if (/^\d{4}$/.test(dateString)) {
      return dateString;
    }
    
    // Handle different date formats from backend
    if (dateString.includes('-')) {
      const parts = dateString.split('-');
      if (parts.length === 3) {
        // Daily format: YYYY-MM-DD
        return new Date(dateString).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      } else if (parts.length === 2) {
        // Monthly format: YYYY-MM
        const date = new Date(parts[0], parts[1] - 1, 1);
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long'
        });
      }
    }
    
    // Fallback for other formats
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  // Helper to determine if there's data for the selected report type
  const hasDataForReport = (data, type) => {
    if (!data) return false;
    switch (type) {
      case 'sales':
        return Array.isArray(data) && data.length > 0;
      case 'inventory':
        // Inventory returns an object with summary metrics even when products array may be empty
        return typeof data === 'object';
      case 'bookings':
        // Bookings returns an object with summary metrics even when there are zero bookings
        return typeof data === 'object';
      case 'coupons':
        // Coupons returns an object with summary metrics even when coupons array may be empty
        return typeof data === 'object';
      default:
        return !!data;
    }
  };

  const exportToCSV = () => {
    if (!hasDataForReport(reportData, reportType)) return;

    const lines = [];
    const pushSectionHeader = (title) => {
      lines.push(title);
    };
    const pushRow = (cols) => {
      // Basic CSV escaping for commas and quotes
      const escaped = cols.map(val => {
        if (val === null || val === undefined) return '';
        const s = String(val);
        const needsQuotes = s.includes(',') || s.includes('"') || s.includes('\n');
        const escapedS = s.replace(/\"/g, '\"\"');
        return needsQuotes ? `"${escapedS}"` : escapedS;
      });
      lines.push(escaped.join(','));
    };

    switch (reportType) {
      case 'sales': {
        pushSectionHeader('Sales Report');
        pushRow(['Date', 'Total Sales', 'Transaction Count', 'Average Sale']);
        reportData.forEach(item => {
          const avg = item.transaction_count > 0 ? (parseFloat(item.total_sales || 0) / parseInt(item.transaction_count || 0)) : 0;
          pushRow([
            formatDate(item.period || item.date),
            formatCurrency(item.total_sales || 0),
            item.transaction_count || 0,
            formatCurrency(avg)
          ]);
        });
        break;
      }
      case 'inventory': {
        pushSectionHeader('Inventory Summary');
        pushRow(['Metric', 'Value']);
        pushRow(['Total Products', reportData.total_products || 0]);
        pushRow(['Low Stock Items', reportData.low_stock_items || 0]);
        pushRow(['Out of Stock Items', reportData.out_of_stock_items || 0]);
        pushRow(['Total Inventory Value', formatCurrency(reportData.total_value || 0)]);
        lines.push('');
        pushSectionHeader('Products');
        pushRow(['Product Name', 'Stock Level', 'Status', 'Unit Price', 'Total Value']);
        (reportData.products || []).forEach(item => {
          const unitPrice = parseFloat(item.price || 0);
          const stockLevel = parseInt(item.stock_level || 0);
          const totalValue = unitPrice * stockLevel;
          pushRow([
            item.name,
            stockLevel,
            item.stock_status,
            formatCurrency(unitPrice),
            formatCurrency(totalValue)
          ]);
        });
        break;
      }
      case 'bookings': {
        pushSectionHeader('Bookings Summary');
        pushRow(['Metric', 'Value']);
        pushRow(['Total Bookings', reportData.total_bookings || 0]);
        pushRow(['Total Revenue', formatCurrency(reportData.total_revenue || 0)]);
        pushRow(['Scheduled', reportData.scheduled_bookings || 0]);
        pushRow(['Pending Confirmation', reportData.pending_confirmation_bookings || 0]);
        pushRow(['Cancelled', reportData.cancelled_bookings || 0]);
        pushRow(['Completed', reportData.completed_bookings || 0]);
        if (reportData.bookings_by_service && Object.keys(reportData.bookings_by_service).length > 0) {
          lines.push('');
          pushSectionHeader('Bookings by Service');
          pushRow(['Service Name', 'Total Bookings', 'Revenue']);
          Object.entries(reportData.bookings_by_service).forEach(([serviceName, data]) => {
            pushRow([serviceName, data.count || 0, formatCurrency(data.revenue || 0)]);
          });
        }
        break;
      }
      case 'coupons': {
        pushSectionHeader('Coupons Summary');
        pushRow(['Metric', 'Value']);
        pushRow(['Total Coupons', reportData.total_coupons || 0]);
        pushRow(['Active Coupons', reportData.active_coupons || 0]);
        pushRow(['Expired Coupons', reportData.expired_coupons || 0]);
        pushRow(['Total Usage', reportData.total_usage || 0]);
        lines.push('');
        pushSectionHeader('Coupons Details');
        pushRow(['Coupon Code', 'Discount Type', 'Discount Value', 'Used Count', 'Usage Limit', 'Usage Rate', 'Status', 'Valid Until']);
        (reportData.coupons || []).forEach(c => {
          const usageRateDisplay = typeof c.usage_rate === 'string' ? c.usage_rate : `${c.usage_rate}%`;
          pushRow([
            c.code,
            c.discount_type,
            c.discount_type === 'percentage' ? `${c.discount_value}%` : formatCurrency(c.discount_value || 0),
            c.used_count || 0,
            c.usage_limit || '',
            usageRateDisplay,
            c.status,
            c.valid_until ? formatDate(new Date(c.valid_until).toISOString().split('T')[0]) : ''
          ]);
        });
        break;
      }
      default:
        break;
    }

    const csvContent = lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${reportType}_report_${dateRange.startDate}_to_${dateRange.endDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    handleSuccess(`${reportType} report exported successfully`);
  };

  const renderSalesReport = () => {
    if (!reportData || reportData.length === 0) return null;

    // Calculate totals from the actual data structure
    const totalSales = reportData.reduce((sum, item) => sum + parseFloat(item.total_sales || 0), 0);
    const totalTransactions = reportData.reduce((sum, item) => sum + parseInt(item.transaction_count || 0), 0);
    const averageSale = totalTransactions > 0 ? totalSales / totalTransactions : 0;

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Total Sales</div>
            <div className="text-3xl font-bold text-green-600">{formatCurrency(totalSales)}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Total Transactions</div>
            <div className="text-3xl font-bold text-blue-600">{totalTransactions}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Average Sale</div>
            <div className="text-3xl font-bold text-purple-600">{formatCurrency(averageSale)}</div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Sales
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transactions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Average Sale
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportData.map((item, index) => {
                  // Calculate average sale for each row
                  const rowAverage = item.transaction_count > 0 ? item.total_sales / item.transaction_count : 0;
                  
                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(item.period || item.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        {formatCurrency(item.total_sales)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.transaction_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(rowAverage)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderInventoryReport = () => {
    if (!reportData) return null;

    // Handle backend response structure
    const products = reportData.products || [];
    const lowStockItems = reportData.low_stock_items || 0;
    const outOfStockItems = reportData.out_of_stock_items || 0;
    const totalValue = reportData.total_value || 0;

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Total Inventory Value</div>
            <div className="text-3xl font-bold text-green-600">{formatCurrency(totalValue)}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Low Stock Items</div>
            <div className="text-3xl font-bold text-yellow-600">{lowStockItems}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Out of Stock Items</div>
            <div className="text-3xl font-bold text-red-600">{outOfStockItems}</div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.stock_level}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        item.stock_status === 'in_stock' ? 'bg-green-100 text-green-800' :
                        item.stock_status === 'low_stock' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {item.stock_status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency((parseFloat(item.price || 0) * parseInt(item.stock_level || 0)))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderBookingsReport = () => {
    if (!reportData) return null;

    // Handle backend response structure
    const totalBookings = reportData.total_bookings || 0;
    const totalRevenue = reportData.total_revenue || 0;
    const scheduledBookings = reportData.scheduled_bookings || 0;
    const pendingBookings = reportData.pending_confirmation_bookings || 0;
    const cancelledBookings = reportData.cancelled_bookings || 0;
    const completedBookings = reportData.completed_bookings || 0;

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Total Bookings</div>
            <div className="text-3xl font-bold text-blue-600">{totalBookings}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Total Revenue</div>
            <div className="text-3xl font-bold text-green-600">{formatCurrency(totalRevenue)}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Completed Bookings</div>
            <div className="text-3xl font-bold text-purple-600">{completedBookings}</div>
          </div>
        </div>

        {/* Booking Status Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Scheduled</div>
            <div className="text-2xl font-bold text-blue-600">{scheduledBookings}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Pending Confirmation</div>
            <div className="text-2xl font-bold text-yellow-600">{pendingBookings}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Cancelled</div>
            <div className="text-2xl font-bold text-red-600">{cancelledBookings}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Completed</div>
            <div className="text-2xl font-bold text-green-600">{completedBookings}</div>
          </div>
        </div>

        {/* Bookings by Service */}
        {reportData.bookings_by_service && Object.keys(reportData.bookings_by_service).length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Bookings by Service</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Service Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Bookings
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Revenue
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Object.entries(reportData.bookings_by_service).map(([serviceName, data], index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {serviceName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {data.count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        {formatCurrency(data.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCouponsReport = () => {
    if (!reportData) return null;

    // Handle backend response structure
    const coupons = reportData.coupons || [];
    const totalDiscount = coupons.reduce((sum, item) => sum + parseFloat(item.discount_amount || 0) * parseInt(item.used_count || 0), 0);
    const totalUsage = reportData.total_usage || 0;
    const activeCoupons = reportData.active_coupons || 0;
    const totalCoupons = reportData.total_coupons || 0;
    const expiredCoupons = reportData.expired_coupons || 0;

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Total Coupons</div>
            <div className="text-3xl font-bold text-blue-600">{totalCoupons}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Active Coupons</div>
            <div className="text-3xl font-bold text-green-600">{activeCoupons}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Expired Coupons</div>
            <div className="text-3xl font-bold text-red-600">{expiredCoupons}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Total Usage</div>
            <div className="text-3xl font-bold text-purple-600">{totalUsage}</div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Coupon Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Discount Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usage Count
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usage Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {coupons.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(item.discount_amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.used_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {typeof item.usage_rate === 'string' ? item.usage_rate : `${item.usage_rate}%`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        item.status === 'active' ? 'bg-green-100 text-green-800' :
                        item.status === 'expired' ? 'bg-red-100 text-red-800' :
                        item.status === 'exhausted' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {item.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderReport = () => {
    switch (reportType) {
      case 'sales':
        return renderSalesReport();
      case 'inventory':
        return renderInventoryReport();
      case 'bookings':
        return renderBookingsReport();
      case 'coupons':
        return renderCouponsReport();
      default:
        return null;
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
        <button
          onClick={exportToCSV}
          disabled={!hasDataForReport(reportData, reportType)}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md font-medium transition-colors"
          aria-label="Export report data to CSV file"
        >
          Export CSV
        </button>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow p-6 mb-6" role="region" aria-label="Report configuration controls">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label htmlFor="report-type" className="block text-sm font-medium text-gray-700 mb-2">
              Report Type
            </label>
            <select
              id="report-type"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-describedby="report-type-help"
            >
              <option value="sales">Sales Report</option>
              <option value="inventory">Inventory Report</option>
              <option value="bookings">Bookings Report</option>
              <option value="coupons">Coupons Report</option>
            </select>
            <span id="report-type-help" className="sr-only">Select the type of report to generate</span>
          </div>

          {(reportType === 'sales' || reportType === 'bookings') && (
            <div>
              <label htmlFor="group-by" className="block text-sm font-medium text-gray-700 mb-2">
                Group By
              </label>
              <select
                id="group-by"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-describedby="group-by-help"
              >
                <option value="daily">Daily</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
              <span id="group-by-help" className="sr-only">Select how to group the report data</span>
            </div>
          )}

          <div>
            <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              id="start-date"
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-describedby="start-date-help"
            />
            <span id="start-date-help" className="sr-only">Select the start date for the report</span>
          </div>

          <div>
            <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <input
              id="end-date"
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-describedby="end-date-help"
            />
            <span id="end-date-help" className="sr-only">Select the end date for the report</span>
          </div>
        </div>
      </div>

      {/* Report Content */}
      {loading ? (
        <div className="flex justify-center items-center h-64" role="status" aria-label="Loading report data">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <span className="sr-only">Loading report data...</span>
        </div>
      ) : hasDataForReport(reportData, reportType) ? (
        <div role="region" aria-label={`${reportType} report results`}>
          {renderReport()}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-12 text-center" role="status" aria-label="No report data available">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No data available</h3>
          <p className="mt-1 text-sm text-gray-500">
            No data found for the selected date range and report type.
          </p>
        </div>
      )}
    </div>
  );
};

export default Reports;