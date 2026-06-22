/**
 * useNetworkStatus Hook
 * Monitors network connectivity using navigator.onLine + heartbeat ping.
 * Returns online status, connection type, and triggers callbacks on change.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const HEARTBEAT_TIMEOUT = 5000;  // 5 seconds

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine;
    }
    return true;
  });
  const [connectionType, setConnectionType] = useState('unknown');
  const [lastChecked, setLastChecked] = useState(null);
  const heartbeatTimerRef = useRef(null);

  /**
   * Perform a heartbeat check by pinging the server
   */
  const checkHeartbeat = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT);

      const response = await fetch('/api/health', {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store'
      });

      clearTimeout(timeoutId);
      const online = response.ok;
      setIsOnline(online);
      setLastChecked(Date.now());
      return online;
    } catch {
      setIsOnline(false);
      setLastChecked(Date.now());
      return false;
    }
  }, []);

  /**
   * Get connection info from Network Information API
   */
  const updateConnectionInfo = useCallback(() => {
    if (navigator.connection) {
      setConnectionType(navigator.connection.effectiveType || 'unknown');
    }
  }, []);

  // Listen for browser online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastChecked(Date.now());
      // Verify with heartbeat
      checkHeartbeat();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setLastChecked(Date.now());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Start heartbeat interval
    heartbeatTimerRef.current = setInterval(checkHeartbeat, HEARTBEAT_INTERVAL);

    // Initial heartbeat
    checkHeartbeat();
    updateConnectionInfo();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
      }
    };
  }, [checkHeartbeat, updateConnectionInfo]);

  // Listen for connection changes (Network Information API)
  useEffect(() => {
    if (navigator.connection) {
      const handleConnectionChange = () => {
        updateConnectionInfo();
        // Re-check connectivity when connection type changes
        checkHeartbeat();
      };

      navigator.connection.addEventListener('change', handleConnectionChange);
      return () => {
        navigator.connection.removeEventListener('change', handleConnectionChange);
      };
    }
  }, [checkHeartbeat, updateConnectionInfo]);

  return {
    isOnline,
    connectionType,
    lastChecked,
    checkHeartbeat
  };
}

export default useNetworkStatus;
