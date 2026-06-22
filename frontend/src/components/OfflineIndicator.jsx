/**
 * OfflineIndicator Component
 * Displays offline/online status badge in the header.
 * Shows pending sync count and allows manual sync trigger.
 */

import React from 'react';
import { useOfflineSync } from '../hooks/useOfflineSync';

const OfflineIndicator = () => {
  const {
    syncStatus,
    pendingCount,
    lastSyncTime,
    syncError,
    triggerSync,
    isOnline
  } = useOfflineSync();

  const getStatusConfig = () => {
    switch (syncStatus) {
      case 'synced':
        return {
          icon: '✓',
          label: 'Online',
          bgColor: 'bg-green-100',
          textColor: 'text-green-800',
          dotColor: 'bg-green-500'
        };
      case 'pending':
        return {
          icon: '⏳',
          label: `${pendingCount} pending`,
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-800',
          dotColor: 'bg-yellow-500'
        };
      case 'syncing':
        return {
          icon: '↻',
          label: 'Syncing...',
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-800',
          dotColor: 'bg-blue-500'
        };
      case 'offline':
        return {
          icon: '✕',
          label: 'Offline',
          bgColor: 'bg-red-100',
          textColor: 'text-red-800',
          dotColor: 'bg-red-500'
        };
      case 'error':
        return {
          icon: '⚠',
          label: 'Sync Error',
          bgColor: 'bg-red-100',
          textColor: 'text-red-800',
          dotColor: 'bg-red-500'
        };
      default:
        return {
          icon: '?',
          label: 'Unknown',
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-800',
          dotColor: 'bg-gray-500'
        };
    }
  };

  const config = getStatusConfig();

  const formatLastSync = () => {
    if (!lastSyncTime) return null;
    const date = new Date(lastSyncTime);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex items-center gap-2">
      {/* Status Badge */}
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}
        title={
          syncError
            ? syncError
            : syncStatus === 'synced'
              ? `Last synced: ${formatLastSync() || 'just now'}`
              : syncStatus === 'offline'
                ? 'Working offline — data will sync when reconnected'
                : `${pendingCount} item(s) waiting to sync`
        }
      >
        <span className={`w-2 h-2 rounded-full ${config.dotColor} ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
        <span>{config.icon}</span>
        <span className="hidden sm:inline">{config.label}</span>
      </div>

      {/* Manual Sync Button (only show when pending and online) */}
      {syncStatus === 'pending' && isOnline && (
        <button
          onClick={triggerSync}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
          title="Sync now"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="hidden sm:inline">Sync Now</span>
        </button>
      )}

      {/* Offline Mode Banner — rendered via portal-like placement outside flex parent */}
      {syncStatus === 'offline' && (
        <span
          className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full"
          title={`Offline Mode — ${pendingCount} item(s) pending sync`}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
          </svg>
          {pendingCount > 0 ? `${pendingCount} pending` : 'Offline'}
        </span>
      )}
    </div>
  );
};

export default OfflineIndicator;
