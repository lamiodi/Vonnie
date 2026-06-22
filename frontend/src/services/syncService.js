/**
 * Sync Service — Manages syncing queued offline data to the server
 * when connectivity is restored. Handles batch uploads, retry with
 * exponential backoff, and conflict resolution.
 */

import {
  getPendingTransactions,
  getPendingExpenses,
  getPendingBookings,
  getPendingInventoryAdjustments,
  markTransactionSynced,
  markExpenseSynced,
  markBookingSynced,
  markInventoryAdjustmentSynced
} from './offlineStore';
import { apiPost, apiGet } from '../utils/api';

const MAX_RETRIES = 10;
const BATCH_SIZE = 50;
const INITIAL_DELAY = 1000;
const MAX_DELAY = 60000;

/**
 * Check if the server is reachable
 * apiGet returns response.data which contains { success, data: { status, serverTime }, message }
 */
export async function checkServerStatus() {
  try {
    const response = await apiGet('/health');
    return !!(response && response.data && response.data.status);
  } catch {
    return false;
  }
}

/**
 * Sync all pending data to the server.
 * Order: Expenses → Inventory Adjustments → Bookings → POS Transactions
 */
export async function syncAll() {
  const results = {
    expenses: { success: 0, failed: 0, conflicts: 0 },
    inventory: { success: 0, failed: 0, conflicts: 0 },
    bookings: { success: 0, failed: 0, conflicts: 0 },
    transactions: { success: 0, failed: 0, conflicts: 0 }
  };

  try {
    // 1. Sync expenses first
    const expenses = await getPendingExpenses();
    if (expenses.length > 0) {
      const expenseResult = await syncExpenses(expenses);
      results.expenses = expenseResult;
    }

    // 2. Sync inventory adjustments
    const adjustments = await getPendingInventoryAdjustments();
    if (adjustments.length > 0) {
      const invResult = await syncInventoryAdjustments(adjustments);
      results.inventory = invResult;
    }

    // 3. Sync bookings
    const bookings = await getPendingBookings();
    if (bookings.length > 0) {
      const bookingResult = await syncBookings(bookings);
      results.bookings = bookingResult;
    }

    // 4. Sync POS transactions last
    const transactions = await getPendingTransactions();
    if (transactions.length > 0) {
      const txnResult = await syncTransactions(transactions);
      results.transactions = txnResult;
    }

  } catch (error) {
    console.error('Sync error:', error);
  }

  return results;
}

/**
 * Sync expenses in batches
 */
async function syncExpenses(expenses) {
  const result = { success: 0, failed: 0, conflicts: 0 };
  const batches = chunkArray(expenses, BATCH_SIZE);

  for (const batch of batches) {
    try {
      const response = await apiPost('/api/sync/batch-expenses', { expenses: batch });
      if (response && response.success) {
        for (const expense of batch) {
          await markExpenseSynced(expense.localId);
        }
        result.success += batch.length;
      } else {
        result.failed += batch.length;
      }
    } catch (error) {
      console.error('Sync expenses batch error:', error);
      result.failed += batch.length;
    }
  }

  return result;
}

/**
 * Sync inventory adjustments in batches
 */
async function syncInventoryAdjustments(adjustments) {
  const result = { success: 0, failed: 0, conflicts: 0 };
  const batches = chunkArray(adjustments, BATCH_SIZE);

  for (const batch of batches) {
    try {
      const response = await apiPost('/api/sync/batch-inventory', { adjustments: batch });
      if (response && response.success) {
        for (const adj of batch) {
          await markInventoryAdjustmentSynced(adj.localId);
        }
        result.success += batch.length;
      } else {
        result.failed += batch.length;
      }
    } catch (error) {
      console.error('Sync inventory batch error:', error);
      result.failed += batch.length;
    }
  }

  return result;
}

/**
 * Sync bookings in batches
 */
async function syncBookings(bookings) {
  const result = { success: 0, failed: 0, conflicts: 0 };
  const batches = chunkArray(bookings, BATCH_SIZE);

  for (const batch of batches) {
    try {
      const response = await apiPost('/api/sync/batch-bookings', { bookings: batch });
      if (response && response.success) {
        for (const booking of batch) {
          await markBookingSynced(booking.localId);
        }
        result.success += batch.length;
      } else {
        result.failed += batch.length;
      }
    } catch (error) {
      console.error('Sync bookings batch error:', error);
      result.failed += batch.length;
    }
  }

  return result;
}

/**
 * Sync POS transactions in batches
 * Handles conflict resolution for stock issues
 */
async function syncTransactions(transactions) {
  const result = { success: 0, failed: 0, conflicts: 0 };
  const batches = chunkArray(transactions, BATCH_SIZE);

  for (const batch of batches) {
    try {
      const response = await apiPost('/api/sync/batch-transactions', { transactions: batch });
      if (response && response.success) {
        for (let i = 0; i < batch.length; i++) {
          const serverTxnNumber = response.data?.[i]?.transactionNumber || batch[i].transactionNumber;
          await markTransactionSynced(batch[i].localId, serverTxnNumber);
        }
        result.success += batch.length;
        // Handle conflicts (e.g., stock issues flagged for review)
        if (response.conflicts && response.conflicts.length > 0) {
          result.conflicts = response.conflicts.length;
        }
      } else {
        result.failed += batch.length;
      }
    } catch (error) {
      console.error('Sync transactions batch error:', error);
      result.failed += batch.length;
    }
  }

  return result;
}

/**
 * Get count of all pending items
 */
export async function getPendingCount() {
  const [transactions, expenses, bookings, inventory] = await Promise.all([
    getPendingTransactions(),
    getPendingExpenses(),
    getPendingBookings(),
    getPendingInventoryAdjustments()
  ]);
  return {
    transactions: transactions.length,
    expenses: expenses.length,
    bookings: bookings.length,
    inventory: inventory.length,
    total: transactions.length + expenses.length + bookings.length + inventory.length
  };
}

/**
 * Utility: Split array into chunks
 */
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Utility: Exponential backoff delay
 */
export function getBackoffDelay(retryCount) {
  const delay = INITIAL_DELAY * Math.pow(2, retryCount);
  return Math.min(delay, MAX_DELAY);
}
