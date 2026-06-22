/**
 * Offline Store Service — IndexedDB wrapper via Dexie.js
 * Manages local data persistence for offline-first operation.
 */

import Dexie from 'dexie';

const db = new Dexie('VonneX2xOffline');

db.version(1).stores({
  products: 'id, name, sku, category, price, stock_level, stock_by_size, updated_at',
  customers: 'id, name, email, phone, last_seen',
  pendingTransactions: '++localId, transactionNumber, createdAt, synced, syncedAt',
  pendingExpenses: '++localId, date, category, synced, syncedAt',
  pendingBookings: '++localId, scheduledTime, status, synced, syncedAt',
  pendingInventoryAdjustments: '++localId, productId, synced, syncedAt',
  syncQueue: '++id, entityType, entityId, action, timestamp, retryCount',
  cacheMeta: 'key, lastSync, ttl'
});

// ─── Product Catalog ───────────────────────────────────────────────

export async function cacheProducts(products) {
  await db.products.bulkPut(products.map(p => ({
    ...p,
    updated_at: new Date().toISOString()
  })));
  await db.cacheMeta.put({ key: 'products', lastSync: Date.now(), ttl: 24 * 60 * 60 * 1000 });
}

export async function getCachedProducts() {
  const meta = await db.cacheMeta.get('products');
  if (meta && (Date.now() - meta.lastSync) > meta.ttl) {
    return null; // Cache expired
  }
  return await db.products.toArray();
}

export async function getCachedProduct(id) {
  return await db.products.get(id);
}

export async function updateCachedProductStock(productId, newStock, size = null) {
  const product = await db.products.get(productId);
  if (!product) return;
  if (size && product.stock_by_size) {
    const stockBySize = { ...product.stock_by_size };
    stockBySize[size] = newStock;
    await db.products.update(productId, { stock_by_size: stockBySize, stock_level: Object.values(stockBySize).reduce((a, b) => a + b, 0) });
  } else {
    await db.products.update(productId, { stock_level: newStock });
  }
}

// ─── Pending Transactions (Offline POS) ────────────────────────────

export async function queueTransaction(transactionData) {
  const localId = await db.pendingTransactions.add({
    ...transactionData,
    transactionNumber: `LOCAL-TXN-${Date.now()}`,
    createdAt: new Date().toISOString(),
    synced: false,
    syncedAt: null
  });
  await addToSyncQueue('transaction', localId, 'create');
  return localId;
}

export async function getPendingTransactions() {
  return await db.pendingTransactions.where('synced').equals(0).toArray();
}

export async function markTransactionSynced(localId, serverTransactionNumber) {
  await db.pendingTransactions.update(localId, {
    synced: true,
    syncedAt: new Date().toISOString(),
    transactionNumber: serverTransactionNumber
  });
}

// ─── Pending Expenses ──────────────────────────────────────────────

export async function queueExpense(expenseData) {
  const localId = await db.pendingExpenses.add({
    ...expenseData,
    createdAt: new Date().toISOString(),
    synced: false,
    syncedAt: null
  });
  await addToSyncQueue('expense', localId, 'create');
  return localId;
}

export async function getPendingExpenses() {
  return await db.pendingExpenses.where('synced').equals(0).toArray();
}

export async function markExpenseSynced(localId) {
  await db.pendingExpenses.update(localId, {
    synced: true,
    syncedAt: new Date().toISOString()
  });
}

export async function queueExpenseEdit(expenseId, expenseData) {
  const localId = await db.pendingExpenses.add({
    ...expenseData,
    expenseId, // Store the original expense ID for syncing
    isEdit: true,
    createdAt: new Date().toISOString(),
    synced: false,
    syncedAt: null
  });
  await addToSyncQueue('expense_edit', localId, 'update');
  return localId;
}

// ─── Pending Bookings ──────────────────────────────────────────────

export async function queueBooking(bookingData) {
  const localId = await db.pendingBookings.add({
    ...bookingData,
    createdAt: new Date().toISOString(),
    synced: false,
    syncedAt: null
  });
  await addToSyncQueue('booking', localId, 'create');
  return localId;
}

export async function getPendingBookings() {
  return await db.pendingBookings.where('synced').equals(0).toArray();
}

export async function markBookingSynced(localId) {
  await db.pendingBookings.update(localId, {
    synced: true,
    syncedAt: new Date().toISOString()
  });
}

// ─── Pending Inventory Adjustments ─────────────────────────────────

export async function queueInventoryAdjustment(adjustmentData) {
  const localId = await db.pendingInventoryAdjustments.add({
    ...adjustmentData,
    createdAt: new Date().toISOString(),
    synced: false,
    syncedAt: null
  });
  await addToSyncQueue('inventory_adjustment', localId, 'create');
  return localId;
}

export async function getPendingInventoryAdjustments() {
  return await db.pendingInventoryAdjustments.where('synced').equals(0).toArray();
}

export async function markInventoryAdjustmentSynced(localId) {
  await db.pendingInventoryAdjustments.update(localId, {
    synced: true,
    syncedAt: new Date().toISOString()
  });
}

// ─── Sync Queue ────────────────────────────────────────────────────

export async function addToSyncQueue(entityType, entityId, action) {
  await db.syncQueue.add({
    entityType,
    entityId,
    action,
    timestamp: Date.now(),
    retryCount: 0
  });
}

export async function getSyncQueue() {
  return await db.syncQueue.orderBy('timestamp').toArray();
}

export async function removeSyncQueueItem(id) {
  await db.syncQueue.delete(id);
}

export async function incrementRetryCount(id) {
  const item = await db.syncQueue.get(id);
  if (item) {
    await db.syncQueue.update(id, { retryCount: item.retryCount + 1 });
  }
}

// ─── Cache Metadata ────────────────────────────────────────────────

export async function setCacheMeta(key, ttl) {
  await db.cacheMeta.put({ key, lastSync: Date.now(), ttl });
}

export async function isCacheValid(key) {
  const meta = await db.cacheMeta.get(key);
  if (!meta) return false;
  return (Date.now() - meta.lastSync) < meta.ttl;
}

// ─── Settings & Categories (localStorage) ──────────────────────────

export function cacheSettings(settings) {
  localStorage.setItem('offline_settings', JSON.stringify({
    data: settings,
    timestamp: Date.now()
  }));
}

export function getCachedSettings() {
  try {
    const cached = localStorage.getItem('offline_settings');
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    // 48h TTL
    if (Date.now() - parsed.timestamp > 48 * 60 * 60 * 1000) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function cacheCategories(categories) {
  localStorage.setItem('offline_categories', JSON.stringify({
    data: categories,
    timestamp: Date.now()
  }));
}

export function getCachedCategories() {
  try {
    const cached = localStorage.getItem('offline_categories');
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    // 7 day TTL
    if (Date.now() - parsed.timestamp > 7 * 24 * 60 * 60 * 1000) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

// ─── Dashboard Snapshot ────────────────────────────────────────────

export function cacheDashboardSnapshot(snapshot) {
  localStorage.setItem('offline_dashboard_snapshot', JSON.stringify({
    data: snapshot,
    timestamp: Date.now()
  }));
}

export function getCachedDashboardSnapshot() {
  try {
    const cached = localStorage.getItem('offline_dashboard_snapshot');
    if (!cached) return null;
    return JSON.parse(cached);
  } catch {
    return null;
  }
}

// ─── Recent Transactions Cache ─────────────────────────────────────

export function cacheRecentTransactions(transactions) {
  localStorage.setItem('offline_recent_transactions', JSON.stringify({
    data: transactions.slice(0, 100),
    timestamp: Date.now()
  }));
}

export function getCachedRecentTransactions() {
  try {
    const cached = localStorage.getItem('offline_recent_transactions');
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    // 6h TTL
    if (Date.now() - parsed.timestamp > 6 * 60 * 60 * 1000) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

// ─── Clear All Offline Data ────────────────────────────────────────

export async function clearAllOfflineData() {
  await db.products.clear();
  await db.customers.clear();
  await db.pendingTransactions.clear();
  await db.pendingExpenses.clear();
  await db.pendingBookings.clear();
  await db.pendingInventoryAdjustments.clear();
  await db.syncQueue.clear();
  await db.cacheMeta.clear();
  localStorage.removeItem('offline_settings');
  localStorage.removeItem('offline_categories');
  localStorage.removeItem('offline_dashboard_snapshot');
  localStorage.removeItem('offline_recent_transactions');
}

// ─── Storage Quota Management ──────────────────────────────────────

export async function getStorageEstimate() {
  if (navigator.storage && navigator.storage.estimate) {
    return await navigator.storage.estimate();
  }
  return null;
}

export default db;
