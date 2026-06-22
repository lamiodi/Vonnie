# Offline Features & Implementation Plan

## Overview

This document outlines offline-first features for the VonneX2x Management System, enabling core business operations to continue without internet connectivity and syncing data when the connection is restored.

**Current System Context:**
- **Frontend:** React 18 + Vite + Tailwind CSS
- **Backend:** Express.js + PostgreSQL (Supabase)
- **Auth:** JWT-based (stored in localStorage)
- **Existing Features:** POS, Bookings, Inventory, Workers, Attendance, Coupons, Expenses, Reports, Fraud Review, Audit Logs
- **No offline capability exists yet** — this is a greenfield addition

---

## 1. Offline POS (Highest Priority)

### Description
Process sales transactions even when internet is down. Queue transactions locally and sync when connection restores.

### Requirements
- Local product catalog cache (IndexedDB) — products, prices, stock levels, sizes
- Local price and tax calculation (no server round-trip needed)
- Transaction queue with timestamps and unique local IDs
- Sync engine to push queued transactions to server
- Conflict resolution for inventory changes during offline period
- Offline indicator in POS UI
- **Temporary receipt numbers** using `LOCAL-TXN-{timestamp}` format (refactored to real TXN numbers after sync)
- Cart state persistence (survive page refresh during offline sale)

### User Stories
- As a cashier, I can ring up sales without internet
- As a cashier, I see a clear "Offline" badge when disconnected
- As a cashier, my cart survives a page refresh during an offline sale
- As a manager, I see a sync status indicator showing pending transactions
- As a manager, I can see which transactions were created offline after they sync

### Stock Consideration
Offline POS cannot guarantee stock accuracy. On sync:
- If stock is insufficient, flag the transaction for manual review
- Apply optimistic stock deduction locally, validate on sync
- Show "stock may be inaccurate" warning in offline mode

---

## 2. Offline Data Entry

### Description
Allow expense entry, booking creation, and inventory adjustments to be performed offline.

### Requirements
- Expense entry form with local persistence (already exists online — extend for offline)
- Booking creation with local cache
- Inventory adjustment queue (stock counts, not sales)
- Auto-sync when connection restored
- Conflict detection and resolution

### User Stories
- As a manager, I can add expenses while offline
- As a receptionist, I can create bookings during internet outages
- As a warehouse worker, I can adjust stock counts offline

---

## 3. Local Data Persistence

### Description
Cache critical data locally for offline access and fast loading.

### Requirements
- IndexedDB schema for products, customers, recent transactions
- Settings cache (business info, tax rates, categories)
- Current shift data persistence
- Cache invalidation strategy (TTL + manual refresh)
- Storage quota management with LRU eviction

### Data to Cache
| Data | Storage | Sync Priority | TTL | Est. Size |
|------|---------|---------------|-----|-----------|
| Product catalog | IndexedDB | Low | 24h | ~500KB |
| Customer records (recent 200) | IndexedDB | Medium | 12h | ~200KB |
| Recent transactions (last 100) | IndexedDB | High | 6h | ~300KB |
| App settings | localStorage | Low | 48h | ~10KB |
| Current shift data | IndexedDB | Critical | Shift duration | ~50KB |
| User session | localStorage | N/A | Token expiry | ~2KB |
| Expense categories | localStorage | Low | 7 days | ~5KB |

### IndexedDB Schema (Dexie.js)
```javascript
const db = new Database('VonneX2xOffline');

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
```

---

## 4. Offline Reports (Read-Only)

### Description
Provide access to key reports and dashboards using cached data when offline.

### Requirements
- Cached dashboard snapshot (last known stats)
- Shift summary generated locally
- Receipt reprints from local cache
- Date range limited to cached data window
- Clear "Data as of [timestamp]" indicator

### Available Offline Reports
- Daily sales summary (from cached transactions)
- Shift report (from local shift data)
- Receipt reprints (last 50 transactions)
- Basic inventory levels (from cached product catalog)
- Today's expenses (from cached/pending expenses)

### Dashboard Offline Behavior
- Show last known stats with "Last updated: [time]" indicator
- Grey out real-time widgets that require server data
- Show pending sync count in header

---

## 5. Background Sync

### Description
Automatically sync queued data when connection is restored.

### Requirements
- Auto-retry failed requests on reconnect
- Sync status indicator (Synced / Pending / Offline / Syncing)
- Manual sync trigger button
- Retry with exponential backoff (1s → 2s → 4s → 8s → 16s → max 60s)
- Max retry limit (10 attempts) with error notification
- Batch sync for efficiency (group up to 50 items per request)
- **Sync ordering:** Expenses → Inventory Adjustments → Bookings → POS Transactions (respects dependencies)

### Sync Flow
```
1. Detect online event (navigator.onLine OR heartbeat success)
2. Check pending queue (ordered by dependency, then timestamp)
3. For each batch:
   a. Validate data integrity
   b. Push to server
   c. On success: mark synced, update local cache
   d. On conflict: apply resolution strategy
   e. On failure: increment retry, exponential backoff
4. Update sync status UI
5. Notify user of results (success count, conflict count, failure count)
6. Refresh cached data from server
```

### New Backend Endpoints Needed
```
POST /api/sync/batch-transactions  — Bulk create offline transactions
POST /api/sync/batch-expenses      — Bulk create offline expenses
POST /api/sync/batch-bookings      — Bulk create offline bookings
POST /api/sync/batch-inventory     — Bulk create offline inventory adjustments
GET  /api/sync/status              — Check server state for conflict detection
```

---

## 6. Offline-First Architecture

### Description
Core architecture principles for offline-first operation.

### Requirements
- Service Worker for static asset caching (app shell, JS, CSS, images)
- Optimistic UI updates (update immediately, sync in background)
- Conflict detection (timestamp-based or version vectors)
- Network status monitoring (`navigator.onLine` + heartbeat ping every 30s)
- Graceful degradation for online-only features (reports, fraud review, admin settings)

### Architecture Diagram
```
┌──────────────────────────────────────────────────────────────┐
│                        UI Layer (React)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐ │
│  │ POS Page │  │ Expenses │  │ Bookings │  │  Dashboard  │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬──────┘ │
│       │              │              │               │         │
│  ┌────▼──────────────▼──────────────▼───────────────▼──────┐ │
│  │              Offline-Aware Service Layer                  │ │
│  │  (Checks online status, routes to local or server)       │ │
│  └────┬────────────────────────────────────────────┬───────┘ │
│       │                                            │         │
│  ┌────▼──────────────┐                  ┌─────────▼───────┐ │
│  │   Local Store     │                  │   API Client    │ │
│  │   (IndexedDB)     │◄────────────────►│   (Axios)       │ │
│  │   via Dexie.js    │   Sync Engine    │                 │ │
│  └───────────────────┘                  └─────────┬───────┘ │
│                                                    │         │
│  ┌─────────────────────────────────────────────────▼───────┐ │
│  │              Network Monitor + Heartbeat                 │ │
│  │         (navigator.onLine + 30s ping interval)          │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
                  ┌───────────────┐
                  │   Server      │
                  │   (Express)   │
                  │   PostgreSQL  │
                  └───────────────┘
```

### Service Worker Strategy
- **Precache:** App shell, all JS/CSS bundles, static assets
- **Runtime cache:** API responses (products, settings) with stale-while-revalidate
- **Offline fallback:** Serve cached app shell when completely offline

---

## Technical Stack

| Layer | Technology | Status |
|-------|-----------|--------|
| Storage | IndexedDB (via Dexie.js) | **Not installed** — `npm install dexie` |
| Sync | Custom sync queue with timestamps | **Not implemented** |
| Conflict Resolution | Last-write-wins (default), manual merge (critical data) | **Not implemented** |
| Network Detection | `navigator.onLine` + heartbeat ping every 30s | **Not implemented** |
| Service Worker | Workbox via `vite-plugin-pwa` | **Not installed** |
| Queue | In-memory queue persisted to IndexedDB | **Not implemented** |
| PWA | `vite-plugin-pwa` for manifest + SW generation | **Not installed** |

### Recommended New Dependencies
```json
{
  "dexie": "^4.0.0",
  "vite-plugin-pwa": "^0.20.0"
}
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Install Dexie.js and vite-plugin-pwa
- [ ] Set up IndexedDB schema (products, pending transactions, sync queue)
- [ ] Implement network status monitoring hook (`useNetworkStatus`)
- [ ] Create local store service layer (`offlineStore.js`)
- [ ] Add offline indicator UI component (header badge)
- [ ] Cache product catalog on app load (for admin/manager roles)
- [ ] Add `localStorage` cache for settings and categories

### Phase 2: Offline POS (Week 3-4)
- [ ] Implement transaction queue (save to IndexedDB when offline)
- [ ] Build sync engine (`syncService.js`)
- [ ] Add conflict resolution for inventory (flag for review on stock mismatch)
- [ ] Generate temporary receipt numbers (`LOCAL-TXN-{timestamp}`)
- [ ] Cart state persistence (survive refresh)
- [ ] Add batch sync endpoint on backend (`POST /api/sync/batch-transactions`)
- [ ] Show "offline transaction" badge in transaction list until synced

### Phase 3: Offline Data Entry (Week 5-6)
- [ ] Offline expense entry (extend existing Expenses page)
- [ ] Offline booking creation (extend existing Bookings page)
- [ ] Offline inventory adjustments (extend existing Inventory page)
- [ ] Sync queue management UI (show pending items count, manual sync button)
- [ ] Add batch sync endpoints for expenses, bookings, inventory

### Phase 4: Offline Reports & Polish (Week 7-8)
- [ ] Cached dashboard snapshot (store last known stats)
- [ ] Offline shift report (generate from local data)
- [ ] Receipt reprint from local cache
- [ ] Service Worker for app shell caching (via vite-plugin-pwa)
- [ ] Sync status dashboard (show sync history, pending count, last sync time)
- [ ] Storage quota management (LRU eviction for old cached data)
- [ ] Comprehensive testing (simulate offline/online transitions)

---

## Conflict Resolution Strategy

| Data Type | Strategy | Rationale |
|-----------|----------|-----------|
| POS transactions | Append-only, server-side dedup by temp receipt number | Sales are immutable |
| Inventory | Last-write-wins with alert + flag for review | Stock changes are frequent |
| Bookings | Manual merge if conflict (same time slot) | Avoid double-booking |
| Expenses | Last-write-wins | Low conflict likelihood |
| Settings | Server wins | Admin-controlled |

### Conflict Detection
- Each record gets a `version` field (incremented on each update)
- On sync, compare local version with server version
- If server version > local version → conflict detected
- Log all conflicts to `sync_conflicts` table for audit

---

## Security Considerations

- Local data should be encrypted for sensitive info (customer PII) — use `crypto.subtle` for AES-GCM encryption
- Session tokens expire — offline mode limited to cached auth (max 24h)
- No offline access to admin-only features requiring real-time auth (fraud review, admin settings)
- Clear local data on logout (wipe IndexedDB + localStorage)
- Temporary receipt numbers must be clearly distinguishable from real ones
- Offline transactions should be capped (max 50 pending) to prevent abuse

---

## Open Questions

1. ✅ How long should offline data persist before requiring a sync? → **Max 24h TTL on cache, sync on reconnect**
2. ✅ Should offline POS generate temporary receipt numbers? → **Yes, `LOCAL-TXN-{timestamp}` format**
3. ✅ What's the max storage limit for offline queue? → **50 pending transactions, LRU eviction for cache**
4. Should we support multiple devices offline (conflict risk)? → **Phase 2 — single device offline first**
5. Do we need offline mode for mobile only or also desktop? → **Both — PWA approach covers all platforms**

---

## Integration with Existing Features

### Existing Features That Need Offline Awareness

| Feature | Offline Behavior | Priority |
|---------|-----------------|----------|
| **POS** | Full offline support with queue | 🔴 Critical |
| **Expenses** | Full offline support with queue | 🟠 High |
| **Bookings** | Create offline, sync later | 🟠 High |
| **Inventory** | View cached catalog, queue adjustments | 🟡 Medium |
| **Dashboard** | Show cached stats with timestamp | 🟡 Medium |
| **Reports** | Read-only from cache | 🟢 Low |
| **Fraud Review** | Online only | ⚪ N/A |
| **Admin Settings** | Online only | ⚪ N/A |
| **Attendance** | Queue check-in/out | 🟡 Medium |
| **Coupons** | Read-only from cache (validate online) | 🟢 Low |

### Backend Changes Required
1. New batch sync endpoints (see Section 5)
2. `sync_conflicts` table for tracking resolution
3. Version fields on entities that support offline edits
4. Deduplication logic for offline transactions (by temp receipt number)
5. Stock validation on sync (with graceful failure handling)

### Frontend Changes Required
1. New `offlineStore.js` service (Dexie.js wrapper)
2. New `syncService.js` (queue management, batch push, retry logic)
3. New `useNetworkStatus.js` hook
4. New `useOfflineSync.js` hook
5. New `OfflineIndicator.jsx` component
6. New `SyncStatus.jsx` component
7. Modify existing pages: POS, Expenses, Bookings, Inventory, Dashboard
8. Service Worker registration (via vite-plugin-pwa)

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Stock overselling during offline | High | Optimistic local deduction + validation on sync + flag for review |
| Data loss on browser crash | High | Persist queue to IndexedDB immediately, not just in-memory |
| Sync conflicts on concurrent edits | Medium | Version-based detection + manual merge for critical data |
| Storage quota exceeded | Low | LRU eviction, cap pending queue at 50, TTL on cache |
| Stale auth token during offline | Medium | 24h max offline session, force re-auth on sync |
| Multiple device offline edits | High | Phase 2 only — single device offline in Phase 1 |

---

*Document created: 2026-06-20*
*Last updated: 2026-06-20*
*Status: Draft — pending review*
