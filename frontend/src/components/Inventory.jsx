import React, { useState, useEffect, useContext } from 'react';
import { apiGet, apiPost, apiPut, apiDelete, API_ENDPOINTS } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

const Inventory = () => {
  const { user, hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanningMode, setScanningMode] = useState(false);
  const [scannedProduct, setScannedProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sku: '',
    price: '',
    category: '',
    stock_level: '',
    stock_by_size: { S: 0, M: 0, L: 0, XL: 0 },
    duration: '',
    max_duration: ''
  });
  const [useSizeStock, setUseSizeStock] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdmin = hasRole('admin');
  const isManager = hasRole('manager');
  const canManageInventory = isAdmin || isManager;
  const canEditOrDelete = isAdmin;

  useEffect(() => {
    fetchProducts();
    fetchServices();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await apiGet(API_ENDPOINTS.INVENTORY);
      setProducts(Array.isArray(response) ? response : (response.data || []));
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchServices = async () => {
    try {
      const response = await apiGet(API_ENDPOINTS.SERVICES);
      setServices(Array.isArray(response) ? response : (response.data || []));
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      if (activeTab === 'services') setLoading(false);
    }
  };

  useEffect(() => {
    if (products.length >= 0 && services.length >= 0) {
      setLoading(false);
    }
  }, [products, services]);

  // Derived filtered data
  const filteredProducts = products.filter(p => 
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredServices = services.filter(s => 
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const validateForm = () => {
    const errors = {};

    // Common Price validation
    if (!formData.price || parseFloat(formData.price) <= 0) {
      errors.price = 'Price must be greater than 0';
    }

    if (activeTab === 'products') {
      // Stock validation
      if (!useSizeStock) {
        if (formData.stock_level === '' || parseInt(formData.stock_level) < 0) {
          errors.stock_level = 'Stock level cannot be negative';
        }
      } else {
        // Validate size stocks
        const sizes = ['S', 'M', 'L', 'XL'];
        sizes.forEach(size => {
          if (parseInt(formData.stock_by_size[size] || 0) < 0) {
            errors[`stock_${size}`] = `${size} stock cannot be negative`;
          }
        });
      }
      if (!formData.name.trim()) errors.name = 'Product name is required';
      if (!formData.sku.trim()) errors.sku = 'SKU is required';
      if (!formData.category.trim()) errors.category = 'Category is required';
    } else {
      // Service validation
      if (!formData.duration || parseInt(formData.duration) <= 0) {
        errors.duration = 'Duration is required';
      }
      if (!formData.name.trim()) errors.name = 'Service name is required';
      if (!formData.category.trim()) errors.category = 'Category is required';
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

  const handleSizeStockChange = (size, value) => {
    setFormData(prev => ({
      ...prev,
      stock_by_size: {
        ...prev.stock_by_size,
        [size]: parseInt(value) || 0
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      if (activeTab === 'products') {
        const submitData = {
          ...formData,
          price: parseFloat(formData.price),
          stock_level: useSizeStock
            ? Object.values(formData.stock_by_size).reduce((a, b) => a + b, 0)
            : parseInt(formData.stock_level),
          stock_by_size: useSizeStock ? formData.stock_by_size : null
        };
        if (editingItem) {
          await apiPut(`${API_ENDPOINTS.INVENTORY}/${editingItem.id}`, submitData);
        } else {
          await apiPost(API_ENDPOINTS.INVENTORY, submitData);
        }
        fetchProducts();
      } else {
        const serviceData = {
          name: formData.name,
          description: formData.description,
          price: parseFloat(formData.price),
          duration: parseInt(formData.duration),
          max_duration: formData.max_duration ? parseInt(formData.max_duration) : null,
          category: formData.category
        };
        if (editingItem) {
          await apiPut(`${API_ENDPOINTS.SERVICES}/${editingItem.id}`, serviceData);
        } else {
          await apiPost(API_ENDPOINTS.SERVICES, serviceData);
        }
        fetchServices();
      }

      resetForm();
      alert(`${activeTab === 'products' ? 'Product' : 'Service'} saved successfully!`);
    } catch (error) {
      console.error('Error saving:', error);
      alert(error.error?.message || 'Error saving. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    if (activeTab === 'products') {
      const hasSizeStock = item.stock_by_size && Object.keys(item.stock_by_size).length > 0;
      setUseSizeStock(hasSizeStock);
      setFormData({
        ...formData,
        name: item.name,
        description: item.description || '',
        sku: item.sku,
        price: item.price,
        category: item.category,
        stock_level: item.stock_level,
        stock_by_size: hasSizeStock ? item.stock_by_size : { S: 0, M: 0, L: 0, XL: 0 }
      });
    } else {
      setFormData({
        ...formData,
        name: item.name,
        description: item.description || '',
        price: item.price,
        category: item.category,
        duration: item.duration,
        max_duration: item.max_duration || ''
      });
    }
    setShowAddForm(true);
  };

              {/* Add/Edit Form Modal logic */}

  const handleDelete = async (item) => {
    const type = activeTab === 'products' ? 'product' : 'service';
    if (!window.confirm(`Are you sure you want to delete this ${type} "${item.name}"?`)) return;
    try {
      const endpoint = activeTab === 'products' ? API_ENDPOINTS.INVENTORY : API_ENDPOINTS.SERVICES;
      await apiDelete(`${endpoint}/${item.id}`);
      activeTab === 'products' ? fetchProducts() : fetchServices();
      alert(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully!`);
    } catch (error) {
      console.error('Error deleting:', error);
      alert(error?.error?.message || 'Error deleting. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      sku: '',
      price: '',
      category: '',
      stock_level: '',
      stock_by_size: { S: 0, M: 0, L: 0, XL: 0 },
      duration: '',
      max_duration: ''
    });
    setUseSizeStock(false);
    setEditingItem(null);
    setShowAddForm(false);
    setFormErrors({});
  };

  const getStockStatus = (stockLevel) => {
    if (stockLevel === 0) return { status: 'Out of Stock', color: 'text-red-600 bg-red-100' };
    if (stockLevel < 5) return { status: 'Low Stock', color: 'text-yellow-600 bg-yellow-100' };
    return { status: 'In Stock', color: 'text-green-600 bg-green-100' };
  };

  const handleBarcodeInput = (e) => {
    const barcode = e.target.value;
    setBarcodeInput(barcode);

    // Auto-search when barcode is entered (typically 8-13 digits)
    if (barcode.length >= 8 && /^\d+$/.test(barcode)) {
      searchProductByBarcode(barcode);
    }
  };

  const searchProductByBarcode = async (barcode) => {
    try {
      const product = await apiGet(API_ENDPOINTS.INVENTORY_BARCODE(barcode));
      setScannedProduct(product);
      if (scanningMode) {
        // Auto-fill form for quick stock adjustment
        const hasSizeStock = product.stock_by_size && Object.keys(product.stock_by_size).length > 0;
        setUseSizeStock(hasSizeStock);
        setFormData({
          name: product.name,
          description: product.description,
          sku: product.sku,
          price: product.price,
          category: product.category,
          stock_level: product.stock_level,
          stock_by_size: hasSizeStock ? product.stock_by_size : { S: 0, M: 0, L: 0, XL: 0 }
        });
        setEditingProduct(product);
        setShowAddForm(true);
      }
    } catch (error) {
      console.error('Error searching product:', error);
      setScannedProduct(null);
      alert('Product not found with this SKU');
    }
  };

  const toggleScanningMode = () => {
    setScanningMode(!scanningMode);
    setBarcodeInput('');
    setScannedProduct(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64" role="status" aria-label="Loading inventory">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <span className="sr-only">Loading inventory...</span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory & Services</h1>
          <p className="text-gray-600">Manage your product stock and service offerings</p>
        </div>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
          <button
            onClick={toggleScanningMode}
            className={`px-4 py-2 rounded-md focus:outline-none focus:ring-2 ${scanningMode
              ? 'bg-green-500 text-white hover:bg-green-600 focus:ring-green-500'
              : 'bg-gray-500 text-white hover:bg-gray-600 focus:ring-gray-500'
              }`}
            aria-label={scanningMode ? 'Disable scanning mode' : 'Enable scanning mode'}
          >
            {scanningMode ? '📱 Scanning ON' : '📱 Enable Scanner'}
          </button>
          {canManageInventory && (
            <button
              onClick={() => {
                resetForm();
                setShowAddForm(true);
              }}
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition"
            >
              Add {activeTab === 'products' ? 'Product' : 'Service'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 sticky top-0 bg-white z-10">
        <button
          onClick={() => setActiveTab('products')}
          className={`py-2 px-6 font-medium text-sm transition-colors duration-200 border-b-2 ${activeTab === 'products'
            ? 'border-blue-500 text-blue-600'
            : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
        >
          📦 Products
        </button>
        <button
          onClick={() => setActiveTab('services')}
          className={`py-2 px-6 font-medium text-sm transition-colors duration-200 border-b-2 ${activeTab === 'services'
            ? 'border-blue-500 text-blue-600'
            : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
        >
          💇‍♀️ Services
        </button>
        <div className="ml-auto w-1/3 min-w-[200px] pb-2">
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border rounded-full text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm"
          />
        </div>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'products' ? (
        <>
          {/* Barcode Scanner Section */}
          <div className="bg-white p-4 rounded-lg shadow mb-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-3">
              🔍 SKU Scanner {scanningMode && <span className="text-green-600">(Active)</span>}
            </h3>
            <div className="flex flex-col sm:flex-row sm:space-x-3 space-y-3 sm:space-y-0 mb-4">
              <input
                type="text"
                placeholder="Scan or enter SKU..."
                value={barcodeInput}
                onChange={handleBarcodeInput}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="SKU input field"
                autoFocus={scanningMode}
              />
              <button
                onClick={() => searchProductByBarcode(barcodeInput)}
                disabled={!barcodeInput.trim()}
                className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Search product by SKU"
              >
                Search
              </button>
            </div>

            {/* Scanned Product Display */}
            {scannedProduct && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <h4 className="font-semibold text-green-800 mb-2">Product Found:</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-3">
                  <div><strong>Name:</strong> {scannedProduct.name}</div>
                  <div><strong>SKU:</strong> {scannedProduct.sku}</div>
                  <div><strong>Stock:</strong> {scannedProduct.stock_level}</div>
                  <div><strong>Price:</strong> ₦{parseFloat(scannedProduct.price || 0).toFixed(2)}</div>
                </div>
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                  {canEditOrDelete && (
                    <button
                      onClick={() => handleEdit(scannedProduct)}
                      className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                      aria-label="Edit product details"
                    >
                      Edit Product
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Products Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                    <th className="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                        {searchTerm ? 'No matches found for your search' : 'No products found'}
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((product) => {
                      const stockStatus = getStockStatus(product.stock_level);
                      return (
                        <tr key={product.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{product.name}</div>
                          </td>
                          <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.sku}</td>
                          <td className="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.category}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₦{parseFloat(product.price).toLocaleString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {product.stock_level}
                            {product.stock_by_size && Object.keys(product.stock_by_size).length > 0 && (
                              <div className="text-xs text-gray-400">
                                {Object.entries(product.stock_by_size)
                                  .filter(([_, q]) => q > 0)
                                  .map(([s, q]) => `${s}:${q}`)
                                  .join(' ')}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs rounded-full ${stockStatus.color}`}>{stockStatus.status}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                            {canEditOrDelete && (
                              <>
                                <button onClick={() => handleEdit(product)} className="text-blue-600 hover:text-blue-900">Edit</button>
                                <button onClick={() => handleDelete(product)} className="text-red-600 hover:text-red-900">Delete</button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Services Table */
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredServices.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                      {searchTerm ? 'No matches found for your search' : 'No services found'}
                    </td>
                  </tr>
                ) : (
                  filteredServices.map((service) => (
                    <tr key={service.id}>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{service.name}</div>
                        <div className="text-xs text-gray-500 truncate max-w-xs">{service.description}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{service.category}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₦{parseFloat(service.price).toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{service.duration} - {service.max_duration || service.duration} mins</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        {canEditOrDelete && (
                          <>
                            <button onClick={() => handleEdit(service)} className="text-blue-600 hover:text-blue-900">Edit</button>
                            <button onClick={() => handleDelete(service)} className="text-red-600 hover:text-red-900">Delete</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">
                {editingItem ? 'Edit' : 'Add'} {activeTab === 'products' ? 'Product' : 'Service'}
              </h3>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md mt-1 ${formErrors.name ? 'border-red-500' : 'border-gray-300'}`}
                />
                {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
              </div>

              {activeTab === 'products' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">SKU *</label>
                  <input
                    type="text"
                    name="sku"
                    value={formData.sku}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-md mt-1 ${formErrors.sku ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  {formErrors.sku && <p className="text-xs text-red-500 mt-1">{formErrors.sku}</p>}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">Category *</label>
                <input
                  type="text"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md mt-1 ${formErrors.category ? 'border-red-500' : 'border-gray-300'}`}
                />
                {formErrors.category && <p className="text-xs text-red-500 mt-1">{formErrors.category}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Price (₦) *</label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md mt-1 ${formErrors.price ? 'border-red-500' : 'border-gray-300'}`}
                />
                {formErrors.price && <p className="text-xs text-red-500 mt-1">{formErrors.price}</p>}
              </div>

              {activeTab === 'services' ? (
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700">Duration (min) *</label>
                    <input
                      type="number"
                      name="duration"
                      value={formData.duration}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 border rounded-md mt-1 ${formErrors.duration ? 'border-red-500' : 'border-gray-300'}`}
                    />
                    {formErrors.duration && <p className="text-xs text-red-500 mt-1">{formErrors.duration}</p>}
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700">Max Duration</label>
                    <input
                      type="number"
                      name="max_duration"
                      value={formData.max_duration}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md mt-1"
                    />
                  </div>
                </div>
              ) : (
                /* Product Stock Section */
                <div>
                  <div className="flex items-center mb-2">
                    <input
                      type="checkbox"
                      id="useSize"
                      checked={useSizeStock}
                      onChange={(e) => setUseSizeStock(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="useSize" className="ml-2 block text-sm text-gray-900">Track by Size</label>
                  </div>

                  {useSizeStock ? (
                    <div className="grid grid-cols-4 gap-2">
                      {['S', 'M', 'L', 'XL'].map(size => (
                        <div key={size}>
                          <label className="text-xs font-semibold">{size}</label>
                          <input
                            type="number"
                            value={formData.stock_by_size[size]}
                            onChange={(e) => handleSizeStockChange(size, e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Stock Level *</label>
                      <input
                        type="number"
                        name="stock_level"
                        value={formData.stock_level}
                        onChange={handleInputChange}
                        className={`w-full px-3 py-2 border rounded-md mt-1 ${formErrors.stock_level ? 'border-red-500' : 'border-gray-300'}`}
                      />
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md mt-1"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;