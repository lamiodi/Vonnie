import React from 'react';
import POS from '../components/POS';

const POSPage = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6">
        <header className="mb-6" role="banner">
          <h1 className="text-3xl font-bold text-gray-900">Point of Sale</h1>
          <p className="text-gray-600 mt-2">Process sales transactions and manage inventory</p>
        </header>
        
        <main role="main" aria-label="Point of sale interface">
          <POS />
        </main>
      </div>
    </div>
  );
};

export default POSPage;