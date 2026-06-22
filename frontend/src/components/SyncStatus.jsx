/**
 * SyncStatus Component
 * Dashboard widget showing sync history, pending items, and sync results.
 */

import React, { useState } from 'react';
import { useOfflineSync } from '../hooks/useOfflineSync';

const SyncStatus = () => {
  const {
    syncStatus,
    pendingCount,
    lastSyncTime,
    syncError,
    syncResults,
    triggerSync,
    isOnline
  } = useOfflineSync();

  const [expanded, setExpanded] = useState(false);

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const getStatusColor = () => {
    switch (syncStatus) {
      case 'synced': return 'text-green-600';
      case 'pending': return 'text-yellow-600';
      case 'syncing': return 'text-blue-600';
      case 'offline': return 'text-red-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = () => {
    switch (syncStatus) {
      case 'synced': return '✓';
      case 'pending': return '⏳';
      case 'syncing': return '↻';
      case 'offline': return '✕';
      case 'error': return '⚠';
      default: return '?';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`text-lg font-bold ${getStatusColor()}`}>
            {getStatusIcon()}
          </span>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-gray-900">Sync Status</h3>
            <p className="text-xs text-gray-500">
              {syncStatus === 'synced' && 'All data synced'}
              {syncStatus === 'pending' && `${pendingCount} item(s) pending`}
              {syncStatus === 'syncing' && 'Syncing data...'}
              {syncStatus === 'offline' && 'Working offline'}
              {syncStatus === 'error' && 'Sync error'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
              {pendingCount}
            </span>
          )}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-3">
          {/* Status Details */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Status</div>
              <div className={`font-semibold ${getStatusColor()}`}>
                {syncStatus.charAt(0).toUpperCase() + syncStatus.slice(1)}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Last Sync</div>
              <div className="font-semibold text-gray-900">
                {formatTime(lastSyncTime)}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Connection</div>
              <div className={`font-semibold ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                {isOnline ? 'Online' : 'Offline'}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Pending Items</div>
              <div className="font-semibold text-gray-900">
                {pendingCount}
              </div>
            </div>
          </div>

          {/* Sync Results */}
          {syncResults && (
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-xs font-semibold text-blue-800 mb-2">Last Sync Results</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {syncResults.transactions.success > 0 && (
                  <div className="text-green-700">
                    ✓ {syncResults.transactions.success} transaction(s)
                  </div>
                )}
                {syncResults.expenses.success > 0 && (
                  <div className="text-green-700">
                    ✓ {syncResults.expenses.success} expense(s)
                  </div>
                )}
                {syncResults.bookings.success > 0 && (
                  <div className="text-green-700">
                    ✓ {syncResults.bookings.success} booking(s)
                  </div>
                )}
                {syncResults.inventory.success > 0 && (
                  <div className="text-green-700">
                    ✓ {syncResults.inventory.success} inventory adj.
                  </div>
                )}
                {syncResults.transactions.failed > 0 && (
                  <div className="text-red-700">
                    ✕ {syncResults.transactions.failed} transaction(s) failed
                  </div>
                )}
                {syncResults.expenses.failed > 0 && (
                  <div className="text-red-700">
                    ✕ {syncResults.expenses.failed} expense(s) failed
                  </div>
                )}
                {syncResults.bookings.failed > 0 && (
                  <div className="text-red-700">
                    ✕ {syncResults.bookings.failed} booking(s) failed
                  </div>
                )}
                {syncResults.inventory.failed > 0 && (
                  <div className="text-red-700">
                    ✕ {syncResults.inventory.failed} inventory adj. failed
                  </div>
                )}
                {syncResults.transactions.conflicts > 0 && (
                  <div className="text-yellow-700">
                    ⚠ {syncResults.transactions.conflicts} conflict(s)
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Display */}
          {syncError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="text-xs font-semibold text-red-800 mb-1">Error</div>
              <div className="text-xs text-red-600">{syncError}</div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={triggerSync}
              disabled={syncStatus === 'syncing' || !isOnline}
              className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {syncStatus === 'syncing' ? (
                <>
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                  Syncing...
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sync Now
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SyncStatus;
