import React, { useState, useEffect, useContext } from 'react';
import { apiGet, apiPost, apiPut, apiDelete, API_ENDPOINTS } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

const Inventory = () => {
  const { user, hasRole } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanningMode, setScanningMode] = useState(false);
  const [scannedProduct, setScannedProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sku: '',
    price: '',
    category: '',
    stock_level: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdmin = hasRole('admin');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await apiGet(API_ENDPOINTS.INVENTORY);
      setProducts(Array.isArray(response) ? response : (response.data || []));
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const errors = {};
    
    // Price validation
    if (!formData.price || parseFloat(formData.price) <= 0) {
      errors.price = 'Price must be greater than 0';
    } else if (parseFloat(formData.price) > 1000000) {
      errors.price = 'Price cannot exceed ₦1,000,000';
    }
    
    // Stock validation
    if (!formData.stock_level || parseInt(formData.stock_level) < 0) {
      errors.stock_level = 'Stock level cannot be negative';
    } else if (parseInt(formData.stock_level) > 100000) {
      errors.stock_level = 'Stock level cannot exceed 100,000';
    }
    
    // Required fields validation
    if (!formData.name.trim()) errors.name = 'Product name is required';
    if (!formData.sku.trim()) errors.sku = 'SKU is required';
    if (!formData.category.trim()) errors.category = 'Category is required';
    
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
        price: parseFloat(formData.price).toFixed(2),
        stock_level: parseInt(formData.stock_level)
      };
      
      if (editingProduct) {
        await apiPut(`${API_ENDPOINTS.INVENTORY}/${editingProduct.id}`, submitData);
      } else {
        await apiPost(API_ENDPOINTS.INVENTORY, submitData);
      }
      
      fetchProducts();
      resetForm();
      alert(editingProduct ? 'Product updated successfully!' : 'Product added successfully!');
    } catch (error) {
      console.error('Error saving product:', error);
      
      // Handle specific error cases
      if (error.response?.status === 409) {
        alert('A product with this SKU already exists.');
      } else if (error.response?.status === 400) {
        alert('Invalid data. Please check your inputs.');
      } else {
        alert('Error saving product. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      sku: product.sku,
      price: product.price,
      category: product.category,
      stock_level: product.stock_level
    });
    setShowAddForm(true);
  };

  const handleStockAdjustment = async (productId, adjustment, reason) => {
    try {
      await apiPost(`${API_ENDPOINTS.INVENTORY}/adjust/${productId}`, {
        adjustment: parseInt(adjustment),
        reason
      });
      fetchProducts();
      alert('Stock adjusted successfully!');
    } catch (error) {
      console.error('Error adjusting stock:', error);
      alert('Error adjusting stock. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      sku: '',
      price: '',
      category: '',
      stock_level: ''
    });
    setEditingProduct(null);
    setShowAddForm(false);
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
        setFormData({
          name: product.name,
          description: product.description,
          sku: product.sku,
          price: product.price,
          category: product.category,
          stock_level: product.stock_level
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

  const quickStockAdjustment = async (adjustment) => {
    if (!scannedProduct) return;
    
    const reason = prompt('Enter reason for stock adjustment:');
    if (reason) {
      await handleStockAdjustment(scannedProduct.id, adjustment, reason);
      setScannedProduct(null);
      setBarcodeInput('');
    }
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
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 space-y-4 sm:space-y-0" role="banner">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Inventory Management</h2>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
          <button
            onClick={toggleScanningMode}
            className={`px-4 py-2 rounded-md focus:outline-none focus:ring-2 ${
              scanningMode 
                ? 'bg-green-500 text-white hover:bg-green-600 focus:ring-green-500' 
                : 'bg-gray-500 text-white hover:bg-gray-600 focus:ring-gray-500'
            }`}
            aria-label={scanningMode ? 'Disable scanning mode' : 'Enable scanning mode'}
          >
            {scanningMode ? '📱 Scanning ON' : '📱 Enable Scanner'}
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Add new product to inventory"
            >
              Add Product
            </button>
          )}
        </div>
      </div>

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
              {isAdmin && (
                <button
                  onClick={() => quickStockAdjustment(1)}
                  className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                  aria-label="Add 1 to stock"
                >
                  +1 Stock
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => quickStockAdjustment(-1)}
                  className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                  aria-label="Remove 1 from stock"
                >
                  -1 Stock
                </button>
              )}
              {isAdmin && (
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

      {/* Add/Edit Product Form */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="form-title">
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 id="form-title" className="text-lg font-semibold">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close form"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4" role="form" aria-label={editingProduct ? 'Edit product form' : 'Add new product form'}>
              <div>
                <label htmlFor="product-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Product Name *
                </label>
                <input
                  id="product-name"
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  aria-required="true"
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {formErrors.name && (
                  <p className="mt-1 text-sm text-red-600" role="alert">{formErrors.name}</p>
                )}
              </div>
        
              <div>
                <label htmlFor="product-sku" className="block text-sm font-medium text-gray-700 mb-1">
                  SKU *
                </label>
                <input
                  id="product-sku"
                  type="text"
                  name="sku"
                  value={formData.sku}
                  onChange={handleInputChange}
                  required
                  aria-required="true"
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.sku ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {formErrors.sku && (
                  <p className="mt-1 text-sm text-red-600" role="alert">{formErrors.sku}</p>
                )}
              </div>
        
              <div>
                <label htmlFor="product-price" className="block text-sm font-medium text-gray-700 mb-1">
                  Price (₦) *
                </label>
                <input
                  id="product-price"
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleInputChange}
                  required
                  aria-required="true"
                  min="0"
                  step="0.01"
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.price ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {formErrors.price && (
                  <p className="mt-1 text-sm text-red-600" role="alert">{formErrors.price}</p>
                )}
              </div>
        
              <div>
                <label htmlFor="product-category" className="block text-sm font-medium text-gray-700 mb-1">
                  Category *
                </label>
                <input
                  id="product-category"
                  type="text"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  required
                  aria-required="true"
                  placeholder="Enter product category"
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.category ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {formErrors.category && (
                  <p className="mt-1 text-sm text-red-600" role="alert">{formErrors.category}</p>
                )}
              </div>
        
              <div>
                <label htmlFor="product-stock" className="block text-sm font-medium text-gray-700 mb-1">
                  Stock Level *
                </label>
                <input
                  id="product-stock"
                  type="number"
                  name="stock_level"
                  value={formData.stock_level}
                  onChange={handleInputChange}
                  required
                  aria-required="true"
                  min="0"
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.stock_level ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {formErrors.stock_level && (
                  <p className="mt-1 text-sm text-red-600" role="alert">{formErrors.stock_level}</p>
                )}
              </div>
        
              <div>
                <label htmlFor="product-description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="product-description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
        
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 pt-4" role="group" aria-label="Form actions">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`flex-1 bg-blue-500 text-white py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'
                  }`}
                  aria-label={editingProduct ? 'Update product information' : 'Add product to inventory'}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {editingProduct ? 'Updating...' : 'Adding...'}
                    </span>
                  ) : (
                    editingProduct ? 'Update Product' : 'Add Product'
                  )}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={isSubmitting}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Cancel and close form"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden" role="region" aria-label="Inventory products table">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200" role="table" aria-label="Products inventory">
            <thead className="bg-gray-50">
              <tr role="row">
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" role="columnheader" scope="col">
                  Product
                </th>
                <th className="hidden md:table-cell px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" role="columnheader" scope="col">
                  SKU
                </th>
                <th className="hidden sm:table-cell px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" role="columnheader" scope="col">
                  Category
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" role="columnheader" scope="col">
                  Price
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" role="columnheader" scope="col">
                  Stock
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" role="columnheader" scope="col">
                  Status
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" role="columnheader" scope="col">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((product) => {
                const stockStatus = getStockStatus(product.stock_level);
                return (
                  <tr key={product.id} role="row">
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap" role="cell">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{product.name}</div>
                        <div className="text-sm text-gray-500 md:hidden">{product.sku}</div>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900" role="cell">
                      {product.sku}
                    </td>
                    <td className="hidden sm:table-cell px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900" role="cell">
                      {product.category}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900" role="cell">
                      ₦{product.price}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900" role="cell">
                      {product.stock_level}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap" role="cell">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${stockStatus.color}`} role="status" aria-label={`Stock status: ${stockStatus.status}`}>
                        {stockStatus.status}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium" role="cell">
                      <div role="group" aria-label={`Actions for ${product.name}`}>
                        {isAdmin && (
                          <button
                            onClick={() => handleEdit(product)}
                            className="text-indigo-600 hover:text-indigo-900 mr-2 sm:mr-3"
                            aria-label={`Edit ${product.name}`}
                          >
                            Edit
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => {
                              const adjustment = prompt('Enter stock adjustment (positive to add, negative to remove):');
                              const reason = prompt('Enter reason for adjustment:');
                              if (adjustment && reason) {
                                handleStockAdjustment(product.id, adjustment, reason);
                              }
                            }}
                            className="text-green-600 hover:text-green-900"
                            aria-label={`Adjust stock for ${product.name}`}
                          >
                            Adjust
                          </button>
                        )}
                      </div>
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

export default Inventory;