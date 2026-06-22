# MVP Product Improvement Plan

## Purpose

This document replaces the earlier generic MVP notes with a more practical plan based on:

- the current page structure already in the app
- the backend data model and routes that already exist
- missing operational features needed for day-to-day shop management
- realistic improvements that make the system more complete, profitable, and easier to run

The goal is not just to make the UI look better. The goal is to make the management system reliable for operations, sales, staff management, inventory control, and profit tracking.

## Core product standard

Every page, function, and component in the system must be fully working before the product is considered MVP-ready.

This means:

- no dead buttons
- no placeholder actions pretending to work
- no broken filters, forms, or save flows
- no cards or widgets showing fake values as if they are real business data
- no components that render correctly but fail in actual usage
- no critical actions without proper success, error, and loading states

Each page should be tested for full user flow completion, including:

- create
- view
- edit
- delete or archive where allowed
- search and filtering
- permissions and role behavior
- mobile responsiveness where relevant

### Modal and dialog requirements

All modals, drawers, and popup dialogs must be easy to close and must behave consistently.

- Every modal must have a visible close button
- Every modal should also have a clear cancel or close action where appropriate
- Clicking outside the modal should close it when the action is safe and non-destructive
- Escape key should close the modal where supported
- Destructive confirmation modals should still allow safe exit without accidental submission
- Modal close actions must work on desktop and mobile
- Users should never get trapped inside a modal with no clear way to exit
- Modal forms should preserve or warn about unsaved changes when needed
- Success states should close or reset the modal in a predictable way
- Error states should keep the modal usable and explain what needs fixing

---

## Executive Summary

### What the system already does well

- Covers the main management areas: dashboard, bookings, POS, inventory, workers, attendance, coupons, reports, transactions
- Has strong foundations for bookings, payment handling, inventory, attendance, and role-based access
- Already stores useful business data such as misc charges, coupon usage, payment logs, worker schedules, and transaction items

### What is missing the most

- A proper **Expenses / Shop Daily Cost** section
- A clear **profit view** that combines sales and expenses
- A full **refund workflow**
- Stronger **fraud detection and audit controls**
- Stronger **full-functionality and QA standards** across pages, components, and flows
- Better **inventory operations** like supplier tracking, reorder levels, and movement history in the UI
- Better **staff operations** like time-off requests, correction requests, and shift planning

### Highest-value recommendation

The first major missing business module should be:

## New Module: Expenses / Shop Daily Cost

This should be added as a full page, not just a field inside another page.

### Why it is needed

The system can track sales, bookings, transactions, and misc charges, but it does not currently track normal shop running costs such as:

- fuel
- electricity
- internet
- rent
- logistics
- maintenance
- product purchasing
- staff welfare
- petty cash spending
- marketing costs
- emergency shop expenses

Without this module, the system can show revenue, but not real profit.

### MVP requirements for the Expenses page

- Add expense record
- Edit expense record
- Delete or archive expense record
- Filter by date, category, payment method, and staff user
- Daily, weekly, and monthly expense totals
- Receipt upload or receipt reference
- Notes field for why the money was spent

### Expenses page UX requirements

- Make the page fast to use on desktop and mobile
- Use large clear amount input with currency formatting
- Provide category chips or quick-pick buttons for common expense types
- Add a simple **Quick Add Expense** flow for everyday shop spending
- Support camera upload for receipts on mobile
- Keep the form short for normal use and hide advanced fields under "More details"
- Show today's expenses, this week's expenses, and top categories at the top
- Use clear empty states, success toasts, and inline validation
- Add recent expense history on the same page so staff can confirm what was entered

### Suggested expense fields

- date
- amount
- category
- payment method
- supplier or vendor
- description
- receipt image or receipt number
- recorded by
- approved by
- branch or location if multi-shop support is planned later

### Suggested expense categories

- rent
- electricity
- diesel or fuel
- internet
- product purchase
- maintenance
- logistics
- marketing
- petty cash
- staff welfare
- refund or loss
- miscellaneous

### Where this should connect

- **Dashboard**: show today's expenses, this week's expenses, and net profit
- **Reports**: add expense report and profit report
- **Transactions**: keep sales transactions separate from operating expenses
- **Daily closing flow**: compare expected cash vs actual cash after expenses

---

## Must-Fix Issues Before Heavy Feature Expansion

These are not new features. These are correctness and reliability issues that should be fixed early.

- Sales report logic should be reviewed so transaction counts are not inflated by transaction item joins
- Coupon reporting should use the correct validity field consistently
- Inventory scanner/edit flow should be cleaned up and tested
- Worker creation and schedule saving flow should be corrected
- Hardcoded growth labels and fake comparison values on the dashboard should be replaced with real calculations
- Prompt/alert-based flows should be replaced with proper modals and toasts
- High-risk financial actions should have stronger audit controls and fraud checks
- Every modal should have a working visible close button and safe exit behavior
- All pages and components should be verified for complete working flows before feature expansion

---

## Fraud Detection and Control

Fraud detection should be treated as an operational requirement, especially for transactions, refunds, price overrides, expense entries, and payment verification.

### MVP fraud controls

- Audit log for all payment verification actions
- Audit log for refunds, voids, and cancelled transactions
- Audit log for manual price edits in POS
- Audit log for deleted or edited expense records
- Require manager or admin approval for refunds above a threshold
- Flag duplicate payment references
- Flag unusual discounts or excessive manual price overrides
- Flag unusually high expense entries
- Flag repeated failed payment verification attempts
- Track who created, edited, approved, or verified each financial record

### Recommended fraud alerts

- same payment reference used more than once
- refund requested after transaction already refunded
- expense amount above normal category range
- high-value cash expense without receipt
- transaction edited after completion
- large discount without manager approval
- frequent voids or cancellations by the same user

### Later-stage controls

- risk scoring for suspicious transaction patterns
- weekly fraud summary in management email
- branch or user-level anomaly monitoring

---

## Page-by-Page Recommendations

## Dashboard

### Current strengths

- Good visual summary layout
- Useful quick action concept
- Dashboard already surfaces bookings, revenue, stock, and coupons
- Loading/error handling exists

### MVP improvements

- Replace fake growth indicators with real daily or weekly comparisons
- Add **today expenses**
- Add **today net profit**
- Add **cash summary**: sales, expenses, expected closing cash
- Add **urgent action cards** for low stock, pending refunds, absent staff, and overdue bookings
- Add **recent activity feed** for bookings, stock edits, and transactions

### Nice-to-have later

- Custom dashboard widgets by role
- Drill-down from cards to filtered pages
- Manager day-closing checklist

---

## Bookings

### Current strengths

- Strong filtering and searching
- Good status handling
- Queue logic is already present
- Worker assignment exists

### MVP improvements

- Add quick actions for call, WhatsApp, reschedule, cancel, mark no-show
- Add customer history sidebar when opening a booking
- Add reminder status: not sent, sent, failed
- Add no-show tracking
- Add reschedule reason
- Add wait time and lateness indicator on today's list

### Important business improvements

- Prevent overbooking more clearly in the UI
- Show worker availability before assignment
- Show customer total spend and last visit

---

## POS

### Current strengths

- Handles products and services together
- Has multiple payment methods
- Keeps cart state
- Supports misc charges

### MVP improvements

- Replace prompt-based misc charges with a clean modal form
- Add **receipt preview**
- Add **print / reprint receipt**
- Add **customer lookup history**
- Add **split payment** support
- Add **discount reason** when staff edits prices

### Important business improvements

- Add a full **refund workflow**
- Add voided transaction handling with audit log
- Add cashier shift summary
- Add payment confirmation notes and receipt attachment for transfer payments
- Add manager approval for manual price overrides above a threshold

---

## Inventory

### Current strengths

- Product and service management are both present
- Size-based stock support exists
- Scanner/search flow exists
- Stock adjustment logic exists in backend

### Product channel requirements

Every product must have a clear channel or visibility setting so the system knows where the product should be used:

- **ERP shop product**
  - used inside the ERP/admin system
  - available for POS, inventory, reports, and internal shop operations
  - supports **1 main image**
- **E-commerce product**
  - published to the separate e-commerce frontend domain
  - available through the e-commerce API or product feed
  - supports up to **5 images**
  - should have e-commerce title, description, slug, SEO fields, and publish status
- **Both ERP and e-commerce product**
  - available in the ERP shop and on the e-commerce website
  - should sync stock and price carefully so both channels stay consistent

The inventory product form must include a visible **Product Channel** selector with options like:

- ERP shop only
- E-commerce only
- ERP + e-commerce

This selector should control which systems can see and use the product.

### Product image requirements

Product images should be handled differently depending on the product type and channel:

- **ERP shop products** should support **1 main image**
- **E-commerce products** should support up to **5 images**
- The first image should be treated as the main product image
- E-commerce images should support a gallery or carousel view
- Image upload should work on desktop and mobile
- Images should be compressed or optimized before upload where possible
- Products should show a clear placeholder when no image is uploaded
- Staff should be able to remove, replace, or reorder e-commerce images
- Product images should appear in inventory, POS, reports, and e-commerce product views

### MVP improvements

- Add **bulk stock adjustment**
- Add **stock movement history** in the UI
- Add **reorder level** per product
- Add visual low-stock and out-of-stock priority indicators
- Add product **cost price** editing and display
- Add product image upload support based on product type

### Important business improvements

- Add supplier or vendor information
- Add restock records and purchase history
- Add damaged or lost stock flow
- Add stock count / stock take session
- Add one-click restock recommendations based on reorder level

---

## Workers

### Current strengths

- Role management exists
- Availability and schedules exist
- Worker profile view exists
- Performance view exists

### MVP improvements

- Add **time-off request management**
- Add **shift planning / rota**
- Add proper worker status flow: available, busy, off, absent
- Show clearer personal schedule and weekly summary
- Improve manager tools for activating, archiving, and editing workers

### Important business improvements

- Add commission-ready performance summaries
- Add payroll-ready hours summary
- Add disciplinary notes or internal staff notes
- Add worker document storage later if needed

---

## Attendance

### Current strengths

- GPS and biometric support are already a big advantage
- Separate admin and worker flows exist
- Good attendance history concept

### MVP improvements

- Add **attendance correction request**
- Add **manual approval flow** for corrections
- Add export to CSV or Excel
- Add late reason and exception note
- Add manager visibility for attendance review

### Important business improvements

- Add overtime approval
- Add half-day and leave handling
- Link attendance with shift schedule
- Show missed attendance more clearly by date and worker

---

## Coupons

### Current strengths

- Coupon creation, status, usage, and validity exist
- Usage history already has a base

### MVP improvements

- Add **bulk coupon creation**
- Add **coupon templates**
- Add **expiry reminders**
- Improve analytics to show who used a coupon and campaign performance
- Add targeting rules such as first-time customer only or minimum spend groups

### Important business improvements

- Add automated coupon generation for campaigns
- Add birthday or loyalty coupon later
- Add coupon usage limits by customer

---

## Reports

### Current strengths

- Reports page already covers several areas
- Export exists
- Sales, inventory, bookings, coupons, attendance, and customers are all useful report categories

### MVP improvements

- Add **expense report**
- Add **profit report**
- Add **payment method report**
- Add **staff productivity summary**
- Add **best customer** and **best product** views
- Add **exception and fraud alert report**

### Important business improvements

- Fix any incorrect aggregates before expanding charts
- Add report presets like today, this week, this month
- Add printable summary format for management review
- Add drill-down from report numbers into raw records

### CEO weekly report email

The best schedule for the CEO weekly report is:

- **Day:** Tuesday
- **Time:** Morning
- **Recommended send time:** 9:00 AM

This timing is strong because:

- Monday data for the previous week is fully closed
- staff can correct late entries on Monday if needed
- the CEO receives the report early enough on Tuesday for planning and follow-up

### CEO weekly email should include

- total weekly sales
- total weekly expenses
- weekly net profit
- bookings summary
- top-selling products and services
- low-stock alerts
- refunds and cancelled transactions
- suspicious or flagged financial activity
- attendance exceptions
- short executive summary

### CEO weekly email subject line

- `Vonne X2X Weekly CEO Report | [Start Date] - [End Date]`
- Example: `Vonne X2X Weekly CEO Report | Jun 1 - Jun 7`

### CEO weekly email structure

The email itself should be short, scannable, and executive-friendly.

#### 1. Executive summary

- one short summary of business performance for the week
- highlight whether the week was better or worse than the previous week
- mention the top 3 attention points

#### 2. KPI snapshot

- total weekly sales
- total weekly expenses
- weekly net profit
- total bookings
- completed bookings
- cancelled bookings
- total refunds
- low-stock item count

#### 3. Sales and profit section

- total sales for the week
- sales by payment method
- gross revenue vs net profit
- comparison with previous week
- highest sales day
- lowest sales day

#### 4. Expenses section

- total expenses for the week
- top expense categories
- unusual or high-value expenses
- cash expenses without receipt
- comparison with previous week

#### 5. Operations section

- booking volume summary
- staff attendance exceptions
- top-selling products
- top-selling services
- low-stock alerts

#### 6. Risk and control section

- refund summary
- cancelled transaction summary
- suspicious transaction flags
- suspicious expense flags
- duplicate payment references
- discounts or overrides requiring review

#### 7. Action items

- list the most important follow-ups for management
- keep this to 3 to 5 bullets maximum

### CEO weekly KPI definitions

To keep the report consistent, the main KPIs should be clearly defined.

- **Total weekly sales:** all completed sales transactions within the report date range
- **Total weekly expenses:** all approved expense records within the report date range
- **Weekly net profit:** total weekly sales minus total weekly expenses
- **Total bookings:** all bookings created or scheduled within the selected business rule
- **Completed bookings:** bookings marked completed
- **Cancelled bookings:** bookings cancelled or marked no-show if that is treated separately
- **Total refunds:** total value and count of refunded transactions
- **Low-stock item count:** number of products below reorder threshold
- **Suspicious activity count:** number of flagged transactions, refunds, discounts, or expenses

### CEO weekly PDF attachment structure

The email should include a PDF attachment for a more formal management report.

#### Recommended PDF sections

- cover page with business name, report range, and generation date
- executive summary page
- KPI summary cards
- sales and profit charts
- expense breakdown charts
- bookings and operations summary
- inventory and low-stock summary
- refunds and fraud alert summary
- attendance exception summary
- appendix with detailed tables

#### PDF appendix tables

- daily sales table
- daily expenses table
- top products table
- top services table
- refund table
- suspicious activity table
- low-stock item table
- attendance exception table

### Delivery and formatting rules

- Send automatically every Tuesday at 9:00 AM
- Use the previous full Monday-to-Sunday business week
- Include both email summary and PDF attachment
- Keep the email readable on mobile
- Use simple color indicators for positive, warning, and critical items
- Highlight critical alerts near the top, not buried in the PDF only
- If data is incomplete, show a warning note in the email

### Sample CEO weekly email layout

Below is a sample layout showing how the email should look when sent.

**Subject:** Vonne X2X Weekly CEO Report | Jun 1 - Jun 7

**Email body sample**

Hello CEO,

Please find below the weekly business summary for Jun 1 - Jun 7.

**Executive Summary**

This week delivered strong sales growth with healthy booking volume, but expenses increased due to product restocking and two high-value maintenance costs. Net profit stayed positive, while low-stock alerts and one suspicious refund require follow-up.

**KPI Snapshot**

- Weekly Sales: NGN 4,850,000
- Weekly Expenses: NGN 1,420,000
- Weekly Net Profit: NGN 3,430,000
- Total Bookings: 186
- Completed Bookings: 164
- Cancelled Bookings: 12
- Total Refunds: NGN 95,000
- Low-Stock Items: 8
- Suspicious Activity Flags: 3

**Sales and Profit**

- Best sales day: Friday
- Lowest sales day: Tuesday
- Card payments: 42%
- Transfer payments: 33%
- Cash payments: 25%
- Week-on-week sales change: +11%
- Week-on-week net profit change: +7%

**Expenses**

- Highest expense category: Product Purchase
- High-value expense alert: Generator repair
- Cash expenses without receipt: 1
- Week-on-week expense change: +14%

**Operations**

- Top product: Hair Treatment Kit
- Top service: Premium Braiding
- Attendance exceptions: 4
- Low-stock urgent items: Shampoo 1L, Relaxer Kit, Hair Net

**Risk and Control**

- Duplicate payment references flagged: 1
- Suspicious refunds flagged: 1
- Large discount overrides needing review: 1

**Action Items**

- Review the flagged refund before close of business Tuesday
- Approve urgent restock for low-stock salon items
- Confirm receipt submission for the generator repair expense

The full management report is attached as a PDF for detailed review.

Regards,  
Vonne X2X Management System

### Sample PDF attachment naming format

- `Vonne_X2X_CEO_Weekly_Report_2026-06-01_to_2026-06-07.pdf`

### Sample email design rules

- Keep total email length short enough to scan in under 2 minutes
- Use bold section titles for quick executive reading
- Keep KPI values near the top
- Put high-risk alerts before lower-priority operational notes
- Avoid long paragraphs
- Keep the PDF as the detailed source of truth

### Implementation note

When this is built, the system should generate:

- one email summary for the CEO
- one PDF attachment
- one consistent report date range based on the last completed Monday-to-Sunday week

### Future improvements for the CEO report

- add branch comparison if the business becomes multi-location
- add month-to-date and year-to-date comparison
- add trend charts for 4-week performance
- add AI-generated executive commentary later if needed

---

## Transactions

### Current strengths

- Transaction verification flow exists
- Detail view exists
- Payment method tracking exists

### MVP improvements

- Add **refund flow**
- Add **receipt lookup and reprint**
- Add **better search and filters**
- Add staff audit trail for who verified or edited a transaction

### Important business improvements

- Add voided transaction handling
- Add refund reason and approver
- Add transaction timeline: created, paid, verified, refunded
- Add transaction links back to booking, customer, and payment log
- Add suspicious activity flags and manager review queue

---

## New Supporting Modules Worth Adding

These are realistic additions that make the system feel complete.

## 1. Expenses

- Track daily shop costs
- Show expense trends
- Feed profit calculations

## 2. Daily Closing

- Opening cash
- cash sales
- transfer sales
- expenses paid from cash
- expected closing cash
- actual closing cash
- cash variance

## 3. Refunds

- Request refund
- approve refund
- log reason
- reverse transaction status properly
- include in reports

## 4. Fraud Review

- flagged transactions
- flagged refunds
- duplicate payment references
- abnormal discounts
- abnormal expenses
- manager review and approval notes

## 5. Suppliers and Restocking

- supplier list
- reorder suggestions
- purchase records
- restock history

## 6. Staff Requests

- time off
- attendance correction
- shift changes
- manager approval flow

---

## Priority Roadmap

## Phase 1: Must-Have Business Foundations

- Build Expenses / Shop Daily Cost page
- Add net profit to dashboard and reports
- Fix report accuracy issues
- Replace alerts and prompts with proper UI flows
- Ensure all existing pages, functions, and components are fully functional
- Standardize all modals with visible close buttons and proper cancel behavior
- Add receipt preview and reprint
- Add MVP fraud controls and audit checks
- Improve mobile responsiveness where needed

## Phase 2: Core Operational Control

- Add refund workflow
- Add inventory movement history in UI
- Add product channel selector for ERP shop, e-commerce, and ERP + e-commerce products
- Add product image upload support: ERP shop products get 1 image, e-commerce products get up to 5 images
- Add e-commerce product feed/API support for the separate e-commerce frontend domain
- Add stock and price sync rules for products available on both channels
- Add worker time-off requests and approvals
- Add attendance correction requests
- Add customer history in bookings and POS
- Add fraud review queue and suspicious activity report

## Phase 3: Deeper Management Features

- Add supplier management
- Add reorder levels and restock workflow
- Add shift planning
- Add payroll and commission summaries
- Add better analytics and drill-down reports
- Add advanced anomaly detection for finance and operations

---

## Implementation Checklist

### Phase 1

- [ ] Add Expenses page
- [ ] Add expense categories and filters
- [ ] Add dashboard expense widgets
- [ ] Add net profit calculation
- [ ] Add expense and profit reports
- [ ] Make expense entry flow mobile-friendly and quick to use
- [ ] Replace prompt/alert flows with modals and toasts
- [ ] Verify every page, function, and component is fully functional
- [ ] Remove dead buttons, fake actions, and incomplete flows
- [ ] Ensure every modal has a visible close button
- [ ] Ensure every modal has working cancel/close behavior on desktop and mobile
- [ ] Add safe modal exit behavior for non-destructive dialogs
- [ ] Add receipt preview / reprint
- [ ] Fix existing report and workflow bugs
- [ ] Add core fraud controls and audit logging rules
- [ ] Set CEO weekly email report for Tuesday morning at 9:00 AM

### Phase 2

- [ ] Add refund request and approval flow
- [ ] Add inventory movement history UI
- [ ] Add product channel selector for ERP shop, e-commerce, and ERP + e-commerce products
- [ ] Add product image upload support for ERP shop products and e-commerce products
- [ ] Allow ERP shop products to use 1 main image
- [ ] Allow e-commerce products to use up to 5 images with reorder and remove support
- [ ] Add e-commerce product feed/API support for the separate e-commerce frontend domain
- [ ] Add stock and price sync rules for products available on both channels
- [ ] Add reorder level support
- [ ] Add worker time-off request flow
- [ ] Add attendance correction request flow
- [ ] Add customer history panel
- [ ] Add fraud review queue and suspicious activity report





## Final Recommendation

If the goal is to make this management system feel complete and business-ready, the next focus should be:

1. money accuracy
2. expense tracking
3. fraud detection and audit control
4. refund control
5. inventory operations

The single biggest gap right now is not visual polish. It is the lack of a proper **Expenses / Shop Daily Cost** system and the absence of a true **profit view** across the dashboard and reports.

Once that is added, the system moves from a revenue tracker into a real business management system.
