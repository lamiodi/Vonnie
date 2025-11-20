import React, { useState, useEffect } from 'react';
import { apiGet, apiPost, API_ENDPOINTS } from '../utils/api';
import { formatCurrency, formatDateTime } from '../utils/formatters';

const TransactionManagement = () => {
  const [transactions, setTransactions] = useState([]);
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [verificationData, setVerificationData] = useState({
    payment_reference: '',
    payment_method: 'card',
    notes: ''
  });
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [transactionDetails, setTransactionDetails] = useState(null);

  // Fetch all transactions
  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const response = await apiGet(API_ENDPOINTS.POS_TRANSACTIONS);
      setTransactions(response.transactions || (Array.isArray(response) ? response : []));
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch pending verification transactions
  const fetchPendingTransactions = async () => {
    try {
      setLoading(true);
      const response = await apiGet(API_ENDPOINTS.POS_TRANSACTIONS_PENDING);
      setPendingTransactions(response.transactions || (Array.isArray(response) ? response : []));
    } catch (error) {
      console.error('Error fetching pending transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch transaction details
  const fetchTransactionDetails = async (id) => {
    try {
      setDetailsLoading(true);
      const response = await apiGet(API_ENDPOINTS.POS_TRANSACTION_DETAILS(id));
      setTransactionDetails(response);
      setShowDetailsModal(true);
    } catch (error) {
      console.error('Error fetching transaction details:', error);
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'all') {
      fetchTransactions();
    } else if (activeTab === 'pending') {
      fetchPendingTransactions();
    }
  }, [activeTab]);

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTransactionStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const openVerifyModal = (transaction) => {
    setSelectedTransaction(transaction);
    setVerificationData({
      payment_reference: '',
      payment_method: 'card',
      notes: ''
    });
    setShowVerifyModal(true);
  };

  const handleVerifyPayment = async () => {
    if (!verificationData.payment_reference.trim()) {
      alert('Please enter payment reference');
      return;
    }

    try {
      setVerificationLoading(true);
      const response = await apiPost(
        API_ENDPOINTS.POS_TRANSACTION_VERIFY(selectedTransaction.id),
        verificationData
      );

      alert('Payment verified successfully!');
      setShowVerifyModal(false);
      
      // Refresh the data
      if (activeTab === 'all') {
        fetchTransactions();
      } else if (activeTab === 'pending') {
        fetchPendingTransactions();
      }
    } catch (error) {
      console.error('Error verifying payment:', error);
      alert(error.response?.data?.error || 'Failed to verify payment');
    } finally {
      setVerificationLoading(false);
    }
  };

  const currentTransactions = activeTab === 'all' ? transactions : pendingTransactions;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Transaction Management</h1>
          <p className="text-gray-600">Manage and verify POS transactions</p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('all')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'all'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                All Transactions
              </button>
              <button
                onClick={() => setActiveTab('pending')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'pending'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Pending Verification
                {pendingTransactions.length > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-1">
                    {pendingTransactions.length}
                  </span>
                )}
              </button>
            </nav>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              {activeTab === 'all' ? 'All Transactions' : 'Pending Verification'}
            </h2>
          </div>

          {loading ? (
            <div className="p-6 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p className="mt-2 text-gray-500">Loading transactions...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Transaction ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Transaction Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Coupon
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Staff
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentTransactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        #{transaction.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDateTime(transaction.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatCurrency(transaction.total_amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          getPaymentStatusColor(transaction.payment_status || 'pending')
                        }`}>
                          {(transaction.payment_status || 'pending').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          getTransactionStatusColor(transaction.status || 'pending')
                        }`}>
                          {(transaction.status || 'pending').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {transaction.coupon_code ? (
                          <span className="text-blue-600 font-medium">{transaction.coupon_code}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {transaction.staff_name || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => fetchTransactionDetails(transaction.id)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          View Details
                        </button>
                        {(transaction.payment_status !== 'completed' || transaction.status !== 'completed') && (
                          <button
                            onClick={() => openVerifyModal(transaction)}
                            className="text-blue-600 hover:text-blue-900 bg-blue-50 px-3 py-1 rounded-md text-xs font-medium"
                          >
                            Verify Payment
                          </button>
                        )}
                        {transaction.verified_by_name && (
                          <div className="text-xs text-gray-500 mt-1">
                            Verified by {transaction.verified_by_name}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {currentTransactions.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500">
                    {activeTab === 'all' 
                      ? 'No transactions found' 
                      : 'No transactions pending verification'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Verification Modal */}
        {showVerifyModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Verify Payment</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Reference *
                    </label>
                    <input
                      type="text"
                      value={verificationData.payment_reference}
                      onChange={(e) => setVerificationData({
                        ...verificationData,
                        payment_reference: e.target.value
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter payment reference from POS machine"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Method
                    </label>
                    <select
                      value={verificationData.payment_method}
                      onChange={(e) => setVerificationData({
                        ...verificationData,
                        payment_method: e.target.value
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="card">Card</option>
                      <option value="cash">Cash</option>
                      <option value="transfer">Bank Transfer</option>
                      <option value="pos">External POS</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes (Optional)
                    </label>
                    <textarea
                      value={verificationData.notes}
                      onChange={(e) => setVerificationData({
                        ...verificationData,
                        notes: e.target.value
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows="3"
                      placeholder="Additional notes about the payment verification"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setShowVerifyModal(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleVerifyPayment}
                    disabled={verificationLoading || !verificationData.payment_reference.trim()}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {verificationLoading ? 'Verifying...' : 'Verify Payment'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Transaction Details Modal */}
        {showDetailsModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Transaction Details</h3>
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                {detailsLoading ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <p className="mt-2 text-gray-500">Loading transaction details...</p>
                  </div>
                ) : transactionDetails ? (
                  <div className="space-y-6">
                    {/* Transaction Header */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-500">Transaction ID</p>
                          <p className="font-medium">#{transactionDetails.id}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Transaction Number</p>
                          <p className="font-medium">{transactionDetails.transaction_number}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Date</p>
                          <p className="font-medium">{formatDateTime(transactionDetails.created_at)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Staff</p>
                          <p className="font-medium">{transactionDetails.staff_name || 'Unknown'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Customer Information */}
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Customer Information</h4>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Name</p>
                            <p className="font-medium">{transactionDetails.customer_name || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Email</p>
                            <p className="font-medium">{transactionDetails.customer_email || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Phone</p>
                            <p className="font-medium">{transactionDetails.customer_phone || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Transaction Items */}
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Transaction Items</h4>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Item
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Type
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Quantity
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Unit Price
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Total Price
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {transactionDetails.items && transactionDetails.items.length > 0 ? (
                              transactionDetails.items.map((item, index) => (
                                <tr key={index}>
                                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                    {item.product_name || item.service_name || 'N/A'}
                                  </td>
                                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                    {item.product_id ? 'Product' : 'Service'}
                                  </td>
                                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                    {item.quantity}
                                  </td>
                                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                    {formatCurrency(item.unit_price)}
                                  </td>
                                  <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {formatCurrency(item.total_price)}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan="5" className="px-4 py-2 text-center text-sm text-gray-500">
                                  No items found
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Payment Information */}
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Payment Information</h4>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Subtotal</p>
                            <p className="font-medium">{formatCurrency(transactionDetails.subtotal)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Discount</p>
                            <p className="font-medium">{formatCurrency(transactionDetails.discount_amount || 0)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Total Amount</p>
                            <p className="font-medium">{formatCurrency(transactionDetails.total_amount)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Payment Method</p>
                            <p className="font-medium">{transactionDetails.payment_method || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Payment Status</p>
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              getPaymentStatusColor(transactionDetails.payment_status || 'pending')
                            }`}>
                              {(transactionDetails.payment_status || 'pending').toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Transaction Status</p>
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              getTransactionStatusColor(transactionDetails.status || 'pending')
                            }`}>
                              {(transactionDetails.status || 'pending').toUpperCase()}
                            </span>
                          </div>
                          {transactionDetails.coupon_code && (
                            <div className="col-span-2">
                              <p className="text-sm text-gray-500">Coupon Used</p>
                              <p className="font-medium">{transactionDetails.coupon_code} {transactionDetails.coupon_name && `- ${transactionDetails.coupon_name}`}</p>
                              {transactionDetails.discount_percentage && (
                                <p className="text-xs text-gray-400">{transactionDetails.discount_percentage}% off</p>
                              )}
                              {transactionDetails.fixed_amount && (
                                <p className="text-xs text-gray-400">₦{transactionDetails.fixed_amount} off</p>
                              )}
                            </div>
                          )}
                          {transactionDetails.payment_reference && (
                            <div className="col-span-2">
                              <p className="text-sm text-gray-500">Payment Reference</p>
                              <p className="font-medium">{transactionDetails.payment_reference}</p>
                            </div>
                          )}
                          {transactionDetails.verified_by_name && (
                            <div className="col-span-2">
                              <p className="text-sm text-gray-500">Verified By</p>
                              <p className="font-medium">{transactionDetails.verified_by_name}</p>
                              {transactionDetails.verified_at && (
                                <p className="text-xs text-gray-400">on {formatDateTime(transactionDetails.verified_at)}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Failed to load transaction details</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionManagement;