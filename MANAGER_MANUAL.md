# Vonne X2x Management System - Manager's Manual

## Overview
This manual guides you through managing bookings, workers, and understanding how the system automatically handles your shop's schedule.

---

## 1. Booking Management

### Viewing Bookings
- **Navigate:** Click "Bookings" in the sidebar.
- **Layout:** The table is designed to show all critical info (Customer, Service, Time, Worker, Payment) without horizontal scrolling on large screens.
- **Sticky Columns:** The "Booking #" (left) and "Actions" (right) columns stay visible if you do need to scroll.

### Creating a New Booking (Internal)
1. Click **"New Booking"**.
2. **Customer:**
   - **New Customer:** Enter Name and Phone. (Email is optional).
   - **Existing Customer:** Click "Search Existing Customer" to find them quickly (coming soon).
3. **Services:** Select one or multiple services. The system calculates the total duration automatically.
4. **Worker:** Assign a worker immediately or leave as "Unassigned" to decide later.
5. **Payment:** You can record payment immediately or leave as "Pending".

### Handling Online & Walk-In Bookings
- **Source:** Bookings come from the **Public Website** or the **Walk-In Kiosk**.
- **Status:** They arrive as `Pending Confirmation`.
- **Action Required:**
  1. Click **Edit** (Pencil icon) or **Assign** (Worker icon).
  2. Select a **Worker**.
  3. Confirm the time.
  4. Change status to `Scheduled`.

### Quick Actions
- **Pay:** Click the `💳 Pay` button to quickly record a payment.
- **Start:** Click `▶ Start` when the service actually begins.
- **Complete:** Click `✅ Complete` when finished. **Note:** Ensure payment is collected before completing!

---

## 2. Automated Scheduling Logic (How Slots Work)

The system automatically hides time slots that don't fit your operating hours. You don't need to calculate this manually.

### Operating Hours
- **Regular Days (Mon, Wed-Sat):** 8:00 AM – 8:30 PM
- **Sundays:** 1:00 PM – 7:00 PM
- **Tuesdays:** **CLOSED**

### How It Protects You
The system checks: **"Can this service finish before we close?"**

#### Example 1: Short Service (1 Hour)
- **Regular Day:** Last slot is **7:30 PM** (Finishes at 8:30 PM).
- **Sunday:** Last slot is **6:00 PM** (Finishes at 7:00 PM).

#### Example 2: Long Service (7 Hours)
- **Regular Day:** Last slot is **1:30 PM**.
  - *Why?* 1:30 PM + 7 hours = 8:30 PM.
  - Starting any later (e.g., 2:00 PM) would mean staying open until 9:00 PM, so the system **hides** those slots.
- **Sunday:** **0 Slots Available**.
  - *Why?* You are open for 6 hours (1-7 PM), but the service needs 7 hours. It's impossible to fit.

---

## 3. Worker Assignment & Availability

- **Conflict Prevention:** The system prevents you from assigning a worker to two jobs at the same time.
- **Duration Awareness:** It knows that a "3-hour braids" service blocks the worker for 3 full hours, not just the start time.

---

## 4. Privacy & Data
- **Public Forms:** We made Email and Instagram **Optional** to make booking faster and less intrusive for clients.
- **Internal Forms:** You only *need* a Name and Phone number to create a booking.

---

## 5. Troubleshooting

**"No slots available"**
- Check if it's a **Tuesday** (Closed).
- Check if the service is **too long** for the remaining hours of the day (especially Sundays).
- Check if the selected date is in the past.

**"Worker Unavailable"**
- The worker likely has another booking overlapping with this time. Check the main schedule.

---

## 6. Worker Management & Schedules

### Managing Staff
- **Roles:**
  - **Admin:** Full system access.
  - **Manager:** Can manage staff, bookings, inventory, and run reports.
  - **Staff:** Restricted view. They can see their own schedule and handle assigned bookings.
- **Adding/Editing Workers:** You can create new staff, assign their specific roles, enter their contact info, and manage their system access.
- **Worker Availability Settings:** Each staff member has a Weekly Schedule. Ensure it is accurate because the system uses this combined with the shop hours to automatically schedule bookings.
- **Worker Metrics:** Clicking on a worker's profile shows their specific metrics, such as Completion Rate, Revenue generated, Rating, and current assignments.

### Attendance Tracking (GPS-Verified)
- **Check-In/Check-Out:** Staff members check in directly on their devices.
- **GPS Verification:** The system verifies if the worker is within 500 meters of the shop. If outside the zone, their login is flagged or rejected.
- **Admin/Manager Exemption:** Higher-level roles are exempt from mandatory attendance checking.
- **Monitoring:** You can view the Daily Attendance history and see statuses like `Present`, `Late`, `Absent` (Missed Attendance).

---

## 7. Reports & Analytics

The system generates automated insights across various areas of the business. You can view patterns daily, monthly, or yearly, and export findings as CSV files.

### Available Reports:
- **Sales Report:** Tracks Total Sales, Number of Transactions, and Average Sale Value.
- **Inventory Report:** Gives a quick snapshot of the Total Inventory Value and highlights items that are `Low Stock` or `Out of Stock`.
- **Bookings Report:** Shows Total Bookings, broken down by status (Scheduled vs Cancelled vs Completed) and which services are generating the most revenue. 
- **Coupons Report:** Analyzes active/expired discount codes, showing their usage rates and financial impact.
- **Missed Attendance:** Quickly view all workers who failed to clock in for the day.

### Customer Export
- Click **"Export Customers"** on the Reports page to download a `.csv` of all customer names, emails, and phone numbers—ideal for marketing and newsletters.

---

## 8. Point of Sale (POS) & Inventory

- **Unified Cart:** Process walk-ins easily. You can add services and products in a single transaction.
- **Stock Tracking:** Stock levels update dynamically. When a product is sold through the POS, its inventory level drops automatically.
- **Alerts:** You'll be notified via the Inventory Report when items are running out.

---

## 9. Coupons & Marketing Campaigns

- **Creating Discounts:** You can set up Percentage (%) or Fixed Amount (₦) discounts.
- **Usage Limits:** Limit how many times a coupon can be used to prevent overuse.
- **Expiration:** Set an exact "Valid Until" date so the coupon stops working automatically.
