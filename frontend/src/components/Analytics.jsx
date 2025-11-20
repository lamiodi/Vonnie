import React, { useState, useEffect, useRef, useContext } from 'react';
import { Link } from 'react-router-dom';
import AuthContext from '../contexts/AuthContext';
import axios from 'axios';
import { handleError, handleSuccess } from '../utils/errorHandler';

const Analytics = () => {
  const { user } = useContext(AuthContext);
  const [salesData, setSalesData] = useState(null);
  const [inventoryData, setInventoryData] = useState(null);
  const [bookingData, setBookingData] = useState(null);
  const [couponData, setCouponData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('monthly');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [errorMessages, setErrorMessages] = useState([]);
  const exportMenuRef = useRef(null);

  useEffect(() => {
    fetchAnalyticsData();
  }, [dateRange, selectedPeriod]);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setExportMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    setErrorMessages([]);
    
    try {
      const requests = [];
      const requestTypes = [];
      
      // Always fetch bookings (available to all authenticated users)
      requests.push(axios.get(`/api/reports/bookings?period=${dateRange}${selectedPeriod ? `&date=${selectedPeriod}` : ''}`));
      requestTypes.push('bookings');
      
      // Only fetch admin-only data if user is admin or manager
      if (user?.role === 'admin' || user?.role === 'manager') {
        requests.push(axios.get(`/api/reports/sales?period=${dateRange}${selectedPeriod ? `&date=${selectedPeriod}` : ''}`));
        requests.push(axios.get('/api/reports/inventory'));
        requests.push(axios.get('/api/reports/coupons'));
        requestTypes.push('sales', 'inventory', 'coupons');
      }
      
      const responses = await Promise.allSettled(requests);
      
      responses.forEach((response, index) => {
        const requestType = requestTypes[index];
        
        if (response.status === 'fulfilled') {
          switch (requestType) {
            case 'sales':
              setSalesData(response.value.data);
              break;
            case 'inventory':
              setInventoryData(response.value.data);
              break;
            case 'bookings':
              setBookingData(response.value.data);
              break;
            case 'coupons':
              setCouponData(response.value.data);
              break;
          }
        } else {
          // Handle errors gracefully
          if (response.reason?.response?.status === 403) {
            // Silently handle 403 errors for staff users
            console.warn(`Access denied to ${requestType} data for ${user?.role} user`);
          } else {
            // Log other errors but don't show them to users
            console.error(`Failed to load ${requestType} data:`, response.reason);
            setErrorMessages(prev => [...prev, `Unable to load ${requestType} data`]);
          }
        }
      });
      
    } catch (error) {
      console.error('Analytics data fetch error:', error);
      // Don't show error to user for permission issues
      if (error.response?.status !== 403) {
        setErrorMessages(['Unable to load some analytics data']);
      }
    } finally {
      setLoading(false);
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDateInputType = () => {
    switch (dateRange) {
      case 'daily':
        return 'date';
      case 'monthly':
        return 'month';
      case 'yearly':
        return 'number';
      default:
        return 'date';
    }
  };

  const getDatePlaceholder = () => {
    switch (dateRange) {
      case 'daily':
        return 'Select date';
      case 'monthly':
        return 'Select month';
      case 'yearly':
        return 'Enter year (e.g., 2024)';
      default:
        return 'Select date';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Export functions
  const exportToCSV = (data, filename) => {
    if (!data || data.length === 0) {
      handleError('No data available to export');
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Handle values that might contain commas or quotes
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    handleSuccess(`${filename} exported successfully`);
  };

  const exportToJSON = (data, filename) => {
    if (!data) {
      handleError('No data available to export');
      return;
    }

    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    handleSuccess(`${filename} exported successfully`);
  };

  const exportAllData = () => {
    const allData = {
      export_date: new Date().toISOString(),
      date_range: dateRange,
      selected_period: selectedPeriod,
      sales_data: salesData,
      inventory_data: inventoryData,
      booking_data: bookingData,
      coupon_data: couponData
    };
    exportToJSON(allData, 'analytics_complete_report');
  };

  const exportSalesData = () => {
    if (salesData?.sales_by_period) {
      exportToCSV(salesData.sales_by_period, 'sales_report');
    }
  };

  const exportBookingData = () => {
    if (bookingData?.bookings_by_status) {
      exportToCSV(bookingData.bookings_by_status, 'booking_report');
    }
  };

  const exportInventoryData = () => {
    if (inventoryData?.low_stock_items) {
      exportToCSV(inventoryData.low_stock_items, 'inventory_report');
    }
  };

  const exportCouponData = () => {
    if (couponData?.active_coupons) {
      exportToCSV(couponData.active_coupons, 'coupon_report');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64" role="status" aria-label="Loading analytics dashboard">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <span className="sr-only">Loading analytics data...</span>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6" role="banner">
        <h2 className="text-2xl font-bold text-gray-800">Analytics Dashboard</h2>
        
        {/* Export Controls */}
         <div className="flex space-x-2" role="group" aria-label="Export controls">
           <div className="relative" ref={exportMenuRef}>
             <button
               onClick={() => setExportMenuOpen(!exportMenuOpen)}
               className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center space-x-2"
               aria-haspopup="true"
               aria-expanded={exportMenuOpen}
             >
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
               </svg>
               <span>Export Data</span>
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
               </svg>
             </button>
             
             <div className={`${exportMenuOpen ? 'block' : 'hidden'} absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-10 border border-gray-200`}>
               <div className="py-1" role="menu">
                 <button
                   onClick={() => {
                     exportAllData();
                     setExportMenuOpen(false);
                   }}
                   className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:outline-none focus:bg-gray-100"
                   role="menuitem"
                 >
                   <div className="flex items-center space-x-2">
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                     </svg>
                     <span>Complete Report (JSON)</span>
                   </div>
                 </button>
                 <hr className="my-1" />
                 <button
                   onClick={() => {
                     exportSalesData();
                     setExportMenuOpen(false);
                   }}
                   className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:outline-none focus:bg-gray-100"
                   role="menuitem"
                 >
                   <div className="flex items-center space-x-2">
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                     </svg>
                     <span>Sales Report (CSV)</span>
                   </div>
                 </button>
                 <button
                   onClick={() => {
                     exportBookingData();
                     setExportMenuOpen(false);
                   }}
                   className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:outline-none focus:bg-gray-100"
                   role="menuitem"
                 >
                   <div className="flex items-center space-x-2">
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                     </svg>
                     <span>Booking Report (CSV)</span>
                   </div>
                 </button>
                 <button
                   onClick={() => {
                     exportInventoryData();
                     setExportMenuOpen(false);
                   }}
                   className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:outline-none focus:bg-gray-100"
                   role="menuitem"
                 >
                   <div className="flex items-center space-x-2">
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                     </svg>
                     <span>Inventory Report (CSV)</span>
                   </div>
                 </button>
                 <button
                   onClick={() => {
                     exportCouponData();
                     setExportMenuOpen(false);
                   }}
                   className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:outline-none focus:bg-gray-100"
                   role="menuitem"
                 >
                   <div className="flex items-center space-x-2">
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                     </svg>
                     <span>Coupon Report (CSV)</span>
                   </div>
                 </button>
               </div>
             </div>
           </div>
         </div>
      </div>

      {/* Date Range Controls */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex space-x-4" role="group" aria-label="Date range controls">
          <label htmlFor="date-range-select" className="sr-only">Select date range type</label>
          <select
            id="date-range-select"
            value={dateRange}
            onChange={(e) => {
              setDateRange(e.target.value);
              setSelectedPeriod('');
            }}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-describedby="date-range-desc"
          >
            <option value="daily">Daily</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
          <span id="date-range-desc" className="sr-only">Choose the time period for analytics data</span>
          
          <label htmlFor="period-input" className="sr-only">Select specific {dateRange} period</label>
          <input
            id="period-input"
            type={getDateInputType()}
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            placeholder={getDatePlaceholder()}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-describedby="period-desc"
          />
          <span id="period-desc" className="sr-only">Select a specific {dateRange} period to filter analytics data</span>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8" role="region" aria-label="Key performance metrics">
        {/* Total Sales */}
        <div className="bg-white rounded-lg shadow p-6" role="article" aria-labelledby="total-sales-title">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-md" aria-hidden="true">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <div className="ml-4">
              <p id="total-sales-title" className="text-sm font-medium text-gray-600">Total Sales</p>
              <p className="text-2xl font-semibold text-gray-900" aria-describedby="total-sales-title">
                {salesData ? formatCurrency(salesData.total_sales || 0) : '₦0.00'}
              </p>
            </div>
          </div>
        </div>

        {/* Total Bookings */}
        <div className="bg-white rounded-lg shadow p-6" role="article" aria-labelledby="total-bookings-title">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-md" aria-hidden="true">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p id="total-bookings-title" className="text-sm font-medium text-gray-600">Total Bookings</p>
              <p className="text-2xl font-semibold text-gray-900" aria-describedby="total-bookings-title">
                {bookingData ? bookingData.total_bookings || 0 : 0}
              </p>
            </div>
          </div>
        </div>

        {/* Low Stock Items */}
        <div className="bg-white rounded-lg shadow p-6" role="article" aria-labelledby="low-stock-title">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-md" aria-hidden="true">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="ml-4">
              <p id="low-stock-title" className="text-sm font-medium text-gray-600">Low Stock Items</p>
              <p className="text-2xl font-semibold text-gray-900" aria-describedby="low-stock-title">
                {inventoryData ? inventoryData.inventory?.filter(item => item.stock_status === 'low_stock').length || 0 : 0}
              </p>
            </div>
          </div>
        </div>

        {/* Active Coupons */}
        <div className="bg-white rounded-lg shadow p-6" role="article" aria-labelledby="active-coupons-title">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-md" aria-hidden="true">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <div className="ml-4">
              <p id="active-coupons-title" className="text-sm font-medium text-gray-600">Active Coupons</p>
              <p className="text-2xl font-semibold text-gray-900" aria-describedby="active-coupons-title">
                {couponData ? couponData.active_coupons?.length || 0 : 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts and Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" role="region" aria-label="Detailed analytics data">
        {/* Sales Summary */}
        <div className="bg-white rounded-lg shadow p-6" role="region" aria-labelledby="sales-summary-title">
          <h3 id="sales-summary-title" className="text-lg font-semibold text-gray-800 mb-4">Sales Summary</h3>
          {salesData && salesData.sales_by_period ? (
            <div className="space-y-4" role="list" aria-label="Sales data by period">
              {salesData.sales_by_period.map((sale, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-md" role="listitem">
                  <div>
                    <p className="font-medium text-gray-900">
                      {dateRange === 'daily' ? formatDate(sale.date) : 
                       dateRange === 'monthly' ? `${sale.month}/${sale.year}` : 
                       sale.year}
                    </p>
                    <p className="text-sm text-gray-600">{sale.transaction_count} transactions</p>
                  </div>
                  <p className="text-lg font-semibold text-green-600">
                    {formatCurrency(sale.total_revenue)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8" role="status">No sales data available</p>
          )}
        </div>

        {/* Booking Status */}
        <div className="bg-white rounded-lg shadow p-6" role="region" aria-labelledby="booking-status-title">
          <h3 id="booking-status-title" className="text-lg font-semibold text-gray-800 mb-4">Booking Status</h3>
          {bookingData && bookingData.bookings_by_status ? (
            <div className="space-y-4" role="list" aria-label="Booking data by status">
              {bookingData.bookings_by_status.map((status, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-md" role="listitem">
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-3 ${
                      status.status === 'scheduled' ? 'bg-green-500' :
                      status.status === 'pending_confirmation' ? 'bg-yellow-500' :
                      status.status === 'cancelled' ? 'bg-red-500' :
                      status.status === 'in-progress' ? 'bg-orange-500' :
                      'bg-blue-500'
                    }`} aria-hidden="true"></div>
                    <p className="font-medium text-gray-900 capitalize">{status.status}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-gray-900">{status.count}</p>
                    <p className="text-sm text-gray-600">
                      {formatCurrency(status.total_revenue || 0)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8" role="status">No booking data available</p>
          )}
        </div>

        {/* Low Stock Alert */}
        <div className="bg-white rounded-lg shadow p-6" role="region" aria-labelledby="low-stock-alert-title">
          <h3 id="low-stock-alert-title" className="text-lg font-semibold text-gray-800 mb-4">Low Stock Alert</h3>
          {inventoryData && inventoryData.inventory ? (
            <div className="space-y-3" role="list" aria-label="Low stock items">
              {inventoryData.inventory
                .filter(item => item.stock_status === 'low_stock')
                .slice(0, 5)
                .map((item, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-red-50 rounded-md" role="listitem">
                    <div>
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-600">{item.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-red-600" role="status" aria-label={`${item.stock_level} items remaining`}>
                        {item.stock_level} left
                      </p>
                      <p className="text-xs text-gray-500">{formatCurrency(item.price)}</p>
                    </div>
                  </div>
                ))}
              {inventoryData.inventory.filter(item => item.stock_status === 'low_stock').length > 5 && (
                <p className="text-sm text-gray-500 text-center">
                  +{inventoryData.inventory.filter(item => item.stock_status === 'low_stock').length - 5} more items
                </p>
              )}
              {inventoryData.inventory.filter(item => item.stock_status === 'low_stock').length === 0 && (
                <p className="text-gray-500 text-center py-8" role="status">All items are well stocked</p>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8" role="status">All items are well stocked</p>
          )}
        </div>

        {/* Coupon Performance */}
        <div className="bg-white rounded-lg shadow p-6" role="region" aria-labelledby="coupon-performance-title">
          <h3 id="coupon-performance-title" className="text-lg font-semibold text-gray-800 mb-4">Coupon Performance</h3>
          {couponData && couponData.active_coupons && couponData.active_coupons.length > 0 ? (
            <div className="space-y-3" role="list" aria-label="Active coupons performance">
              {couponData.active_coupons.slice(0, 5).map((coupon, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-purple-50 rounded-md" role="listitem">
                  <div>
                    <p className="font-medium text-gray-900">{coupon.code}</p>
                    <p className="text-sm text-gray-600">
                      {coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : formatCurrency(coupon.discount_value)} off
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-purple-600">{coupon.usage_count} uses</p>
                    <p className="text-xs text-gray-500">
                      {coupon.usage_limit ? `${coupon.usage_limit - coupon.usage_count} left` : 'Unlimited'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8" role="status">No active coupons</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analytics;