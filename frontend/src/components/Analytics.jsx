import React, { useState, useEffect, useRef, useContext } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiGet, API_ENDPOINTS } from '../utils/api';
import { handleError, handleSuccess } from '../utils/errorHandler';

const Analytics = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview'); // overview, sales, inventory, bookings, coupons
  
  // Dashboard Data
  const [salesData, setSalesData] = useState(null);
  const [inventoryData, setInventoryData] = useState(null);
  const [bookingData, setBookingData] = useState(null);
  const [couponData, setCouponData] = useState(null);
  
  // Report Data (Detailed)
  const [reportData, setReportData] = useState(null);
  
  // Common State
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [period, setPeriod] = useState('daily'); // daily, monthly, yearly
  
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef(null);

  // Initial Load (Dashboard)
  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Fetch detailed report when tab or filters change
  useEffect(() => {
    if (activeTab !== 'overview') {
      fetchReportData();
    }
  }, [activeTab, dateRange, period]);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const requests = [];
      const requestTypes = [];
      
      // Always fetch bookings
      requests.push(apiGet(API_ENDPOINTS.REPORTS_BOOKINGS || '/reports/bookings', { period: 'monthly' }));
      requestTypes.push('bookings');
      
      // Admin/Manager only data
      if (user?.role === 'admin' || user?.role === 'manager') {
        requests.push(apiGet(API_ENDPOINTS.REPORTS_SALES || '/reports/sales', { period: 'monthly' }));
        requests.push(apiGet(API_ENDPOINTS.REPORTS_INVENTORY || '/reports/inventory'));
        requests.push(apiGet(API_ENDPOINTS.REPORTS_COUPONS || '/reports/coupons'));
        requestTypes.push('sales', 'inventory', 'coupons');
      }
      
      const responses = await Promise.allSettled(requests);
      
      responses.forEach((response, index) => {
        if (response.status === 'fulfilled') {
          const type = requestTypes[index];
          if (type === 'sales') setSalesData(response.value);
          if (type === 'inventory') setInventoryData(response.value);
          if (type === 'bookings') setBookingData(response.value);
          if (type === 'coupons') setCouponData(response.value);
        }
      });
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const params = {
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
        period: period
      };

      let endpoint;
      switch (activeTab) {
        case 'sales': endpoint = API_ENDPOINTS.REPORTS_SALES; break;
        case 'inventory': endpoint = API_ENDPOINTS.REPORTS_INVENTORY; break;
        case 'bookings': endpoint = API_ENDPOINTS.REPORTS_BOOKINGS; break;
        case 'coupons': endpoint = API_ENDPOINTS.REPORTS_COUPONS; break;
        default: return;
      }

      const response = await apiGet(endpoint, params);
      setReportData(response.data || response);
    } catch (error) {
      handleError(error, 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '₦0';
    const num = parseFloat(amount);
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' })
      .format(num)
      .replace(/\.00$/, '');
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
      });
    } catch (e) { return dateString; }
  };

  // Export Logic
  const exportToCSV = (data, filename) => {
    if (!data || data.length === 0) {
      handleError(null, 'No data to export');
      return;
    }
    
    // Flatten logic for simple arrays
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const val = row[header];
          return `"${String(val || '').replace(/"/g, '""')}"`;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleExport = () => {
    if (activeTab === 'overview') {
      // Export Dashboard Summary
      const summary = {
        sales: salesData?.total_sales,
        bookings: bookingData?.total_bookings,
        active_coupons: couponData?.active_coupons?.length,
        low_stock: inventoryData?.inventory?.filter(i => i.stock_status === 'low_stock').length
      };
      const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'dashboard_summary.json';
      link.click();
    } else {
      // Export Detailed Report
      // Reuse logic from Reports.jsx for specific formatting if needed, or generic CSV
      if (Array.isArray(reportData)) {
        exportToCSV(reportData, `${activeTab}_report`);
      } else if (reportData && typeof reportData === 'object') {
        // Handle nested arrays for inventory/coupons
        if (activeTab === 'inventory' && reportData.products) exportToCSV(reportData.products, 'inventory_report');
        else if (activeTab === 'coupons' && reportData.coupons) exportToCSV(reportData.coupons, 'coupons_report');
        else if (activeTab === 'bookings' && reportData.bookings_by_service) {
           // Convert object to array for CSV
           const serviceData = Object.entries(reportData.bookings_by_service).map(([k, v]) => ({ service: k, ...v }));
           exportToCSV(serviceData, 'bookings_by_service');
        }
        else {
           // Try to export the main object as a single row or similar
           const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
           const link = document.createElement('a');
           link.href = URL.createObjectURL(blob);
           link.download = `${activeTab}_report.json`;
           link.click();
        }
      }
    }
    setExportMenuOpen(false);
  };

  // Render Functions
  const renderOverview = () => (
    <div className="space-y-8 animate-fade-in">
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(salesData?.total_sales || 0)}
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Bookings</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {bookingData?.total_bookings || 0}
              </p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Low Stock</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {inventoryData?.inventory?.filter(i => i.stock_status === 'low_stock').length || 0}
              </p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Active Coupons</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {couponData?.active_coupons?.length || 0}
              </p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity / Charts Placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Sales Trend</h3>
          {salesData?.sales_by_period ? (
            <div className="space-y-3">
              {salesData.sales_by_period.slice(0, 5).map((sale, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-700">{formatDate(sale.date || sale.period)}</span>
                  <span className="font-semibold text-green-600">{formatCurrency(sale.total_revenue)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No recent sales data</p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Low Stock Alert</h3>
          {inventoryData?.inventory?.filter(i => i.stock_status === 'low_stock').length > 0 ? (
            <div className="space-y-3">
               {inventoryData.inventory.filter(i => i.stock_status === 'low_stock').slice(0, 5).map((item, i) => (
                 <div key={i} className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                   <div>
                     <p className="font-medium text-gray-900">{item.name}</p>
                     <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                   </div>
                   <span className="text-sm font-bold text-red-600">{item.stock_level} left</span>
                 </div>
               ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">All items are well stocked</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderSalesTable = () => {
    if (!reportData || !Array.isArray(reportData)) return <p className="text-center text-gray-500 py-8">No sales data found for this period.</p>;
    
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Sales</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transactions</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Sale</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {reportData.map((item, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(item.period || item.date)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">{formatCurrency(item.total_sales)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.transaction_count}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatCurrency(item.transaction_count > 0 ? item.total_sales / item.transaction_count : 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderInventoryTable = () => {
    const products = reportData?.products || [];
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {products.map((item, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.stock_level}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    item.stock_status === 'in_stock' ? 'bg-green-100 text-green-800' :
                    item.stock_status === 'low_stock' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {item.stock_status.replace('_', ' ').toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatCurrency(item.price * item.stock_level)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderBookingsTable = () => {
    // Show service breakdown if available
    const services = reportData?.bookings_by_service ? Object.entries(reportData.bookings_by_service) : [];
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
           <div className="bg-white p-4 rounded-lg shadow-sm border">
             <p className="text-gray-500 text-sm">Total Revenue</p>
             <p className="text-xl font-bold text-green-600">{formatCurrency(reportData?.total_revenue)}</p>
           </div>
           <div className="bg-white p-4 rounded-lg shadow-sm border">
             <p className="text-gray-500 text-sm">Completed</p>
             <p className="text-xl font-bold text-blue-600">{reportData?.completed_bookings || 0}</p>
           </div>
           <div className="bg-white p-4 rounded-lg shadow-sm border">
             <p className="text-gray-500 text-sm">Cancelled</p>
             <p className="text-xl font-bold text-red-600">{reportData?.cancelled_bookings || 0}</p>
           </div>
           <div className="bg-white p-4 rounded-lg shadow-sm border">
             <p className="text-gray-500 text-sm">Total Bookings</p>
             <p className="text-xl font-bold text-gray-900">{reportData?.total_bookings || 0}</p>
           </div>
        </div>

        {services.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="font-medium text-gray-900">Bookings by Service</h3>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Count</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {services.map(([name, data], i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{data.count}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">{formatCurrency(data.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderCouponsTable = () => {
    const coupons = reportData?.coupons || [];
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Discount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usage</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {coupons.map((item, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.code}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatCurrency(item.discount_amount)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.used_count}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                   <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      item.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                   }`}>
                     {item.status}
                   </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-500 mt-1">Track your business performance</p>
        </div>
        
        <div className="flex gap-2">
           <div className="relative" ref={exportMenuRef}>
             <button
               onClick={() => setExportMenuOpen(!exportMenuOpen)}
               className="px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
             >
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
               </svg>
               Export
             </button>
             {exportMenuOpen && (
               <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-20 border border-gray-100">
                 <button onClick={handleExport} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                   {activeTab === 'overview' ? 'Export Summary (JSON)' : 'Export CSV'}
                 </button>
               </div>
             )}
           </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6 overflow-x-auto">
        <nav className="-mb-px flex space-x-8">
          {['overview', 'sales', 'inventory', 'bookings', 'coupons'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize
                ${activeTab === tab 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Filters (Only for Detailed Reports) */}
      {activeTab !== 'overview' && (activeTab === 'sales' || activeTab === 'bookings') && (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mb-6 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input 
              type="date" 
              value={dateRange.startDate}
              onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})}
              className="px-3 py-2 border rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input 
              type="date" 
              value={dateRange.endDate}
              onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})}
              className="px-3 py-2 border rounded-md text-sm"
            />
          </div>
          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Group By</label>
             <select 
               value={period}
               onChange={(e) => setPeriod(e.target.value)}
               className="px-3 py-2 border rounded-md text-sm"
             >
               <option value="daily">Daily</option>
               <option value="monthly">Monthly</option>
               <option value="yearly">Yearly</option>
             </select>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'sales' && renderSalesTable()}
          {activeTab === 'inventory' && renderInventoryTable()}
          {activeTab === 'bookings' && renderBookingsTable()}
          {activeTab === 'coupons' && renderCouponsTable()}
        </>
      )}
    </div>
  );
};

export default Analytics;
