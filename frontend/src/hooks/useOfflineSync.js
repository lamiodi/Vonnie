/**
 * useOfflineSync Hook
 * Manages automatic syncing when connection is restored.
 * Provides sync status and manual sync trigger.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import { syncAll, getPendingCount } from '../services/syncService';

export function useOfflineSync() {
  const { isOnline, checkHeartbeat } = useNetworkStatus();
  const [syncStatus, setSyncStatus] = useState('synced'); // synced | pending | syncing | offline | error
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [syncResults, setSyncResults] = useState(null);
  const syncInProgressRef = useRef(false);

  /**
   * Update pending count from IndexedDB
   */
  const updatePendingCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count.total);
      if (count.total > 0) {
        setSyncStatus(isOnline ? 'pending' : 'offline');
      } else {
        setSyncStatus(isOnline ? 'synced' : 'offline');
      }
    } catch (error) {
      console.error('Error updating pending count:', error);
    }
  }, [isOnline]);

  /**
   * Trigger manual sync
   */
  const triggerSync = useCallback(async () => {
    if (syncInProgressRef.current) return;
    if (!isOnline) {
      setSyncError('No internet connection');
      return;
    }

    syncInProgressRef.current = true;
    setSyncStatus('syncing');
    setSyncError(null);
    setSyncResults(null);

    try {
      // First verify server is reachable
      const reachable = await checkHeartbeat();
      if (!reachable) {
        setSyncStatus('offline');
        setSyncError('Server unreachable');
        return;
      }

      const results = await syncAll();
      setSyncResults(results);
      setLastSyncTime(Date.now());

      const totalFailed = results.expenses.failed + results.inventory.failed +
        results.bookings.failed + results.transactions.failed;
      const totalSuccess = results.expenses.success + results.inventory.success +
        results.bookings.success + results.transactions.success;

      if (totalFailed > 0 && totalSuccess === 0) {
        setSyncStatus('error');
        setSyncError(`Sync failed: ${totalFailed} item(s) could not be synced`);
      } else if (totalFailed > 0) {
        setSyncStatus('synced');
        setSyncError(`${totalFailed} item(s) had issues — check details`);
      } else {
        setSyncStatus('synced');
      }

      // Update pending count after sync
      await updatePendingCount();

    } catch (error) {
      console.error('Sync error:', error);
      setSyncStatus('error');
      setSyncError(error.message || 'Sync failed');
    } finally {
      syncInProgressRef.current = false;
    }
  }, [isOnline, checkHeartbeat, updatePendingCount]);

  // Auto-sync when coming online and update status
  useEffect(() => {
    if (!isOnline) {
      setSyncStatus('offline');
    } else if (pendingCount === 0) {
      setSyncStatus('synced');
    } else if (!syncInProgressRef.current) {
      setSyncStatus('pending');
      triggerSync();
    } else {
      setSyncStatus('pending');
    }
  }, [isOnline, pendingCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update pending count periodically
  useEffect(() => {
    updatePendingCount();
    const interval = setInterval(updatePendingCount, 30000); // every 30s
    return () => clearInterval(interval);
  }, [updatePendingCount]);

  return {
    syncStatus,
    pendingCount,
    lastSyncTime,
    syncError,
    syncResults,
    triggerSync,
    isOnline,
    updatePendingCount
  };
}

export default useOfflineSync;
