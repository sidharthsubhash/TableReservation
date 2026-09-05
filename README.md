# P07 — Restaurant Table Reservation & Food Ordering System Backend

> **Domain:** Food & Beverage  
> **Course / Academic:** 5th Semester • Christ University • CIA-3 Project Development (L&T EduTech)

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.19-lightgrey.svg)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose%208.5-forestgreen.svg)](https://www.mongodb.com/)
[![Authentication](https://img.shields.io/badge/Auth-JWT%20%2B%20Bcrypt-blue.svg)](https://jwt.io/)

---

## 🍽️ Business Overview & Problem Statement

Modern multi-branch restaurant chains require an integrated digital backend that allows:
1. **Customers** to reserve tables for specific slot windows (with zero risk of double-booking), browse dynamic branch-specific menus, place dine-in/takeaway food orders, make payments, track their order lifecycle, and rate their dining experience.
2. **Kitchen Staff** to view an active FIFO (First-In, First-Out) kitchen order display queue and advance cooking preparation statuses in real-time.
3. **Restaurant Managers & Admins** to oversee multi-branch table inventories, dynamic menu catalogs, automated itemized billing (with taxes & service charges), and executive aggregation analytics (popular dishes, peak booking hours, branch revenue, and table occupancy).

---

## 🚀 Key Objectives & Design Highlights

- **MongoDB Reference & Embedding Strategy**: Referenced models for collections updated independently (`User`, `Branch`, `Table`, `MenuItem`, `Reservation`, `Feedback`), with embedded sub-documents for snapshot immutability (`Order.items[]`, `Order.billing`).
- **Slot-Based Double-Booking Prevention**: Mathematical overlapping interval check (`startDateTime < newEndDateTime && endDateTime > newStartDateTime`) backed by compound MongoDB indexes ensuring strict slot validation.
- **Role-Based Access Control (RBAC)**: Fine-grained middleware authorization for `customer`, `kitchen_staff`, `manager`, and `admin`.
- **Order Lifecycle Engine**: Strict status workflow (`PLACED` ➔ `PREPARING` ➔ `READY` ➔ `SERVED` ➔ `COMPLETED`).
- **Live Kitchen Display Queue**: Real-time ticket calculation with elapsed wait time and delay indicators.
- **Itemized Billing**: Automated computation of subtotal, configurable GST tax (5%), service charge (5%), discounts, and invoice receipt generation.

---

## 🏗️ Architecture & Project Structure

```
cia3-foodreservation/
├── .env.example                                      # Environment variables template
├── package.json                                      # Node.js dependencies and scripts
├── README.md                                         # Detailed system documentation
├── postman/
│   └── Restaurant_Reservation_and_Ordering_API.postman_collection.json # Ready-to-import Postman Collection
├── tests/
│   └── verify_api.js                                 # Automated end-to-end API test suite
└── src/
    ├── server.js                                     # Server entry point & process listeners
    ├── app.js                                        # Express configuration, security middlewares, route mounting
    ├── config/
    │   └── db.js                                     # MongoDB Mongoose connection
    ├── models/
    │   ├── User.js                                   # User schema with bcrypt password hashing
    │   ├── Branch.js                                 # Multi-branch restaurant locations
    │   ├── Table.js                                  # Tables with seating capacity and zones
    │   ├── MenuItem.js                               # Menu catalog with categories and dietary flags
    │   ├── Reservation.js                            # Table reservation slots and conflict constraints
    │   ├── Order.js                                  # Orders with items, workflow, and billing
    │   └── Feedback.js                               # Star ratings (1-5) and reviews
    ├── middlewares/
    │   ├── auth.js                                   # JWT verification & RBAC authorization
    │   ├── validator.js                              # express-validator error formatting
    │   └── errorMiddleware.js                        # Centralized operational error handler
    ├── controllers/
    │   ├── authController.js                         # Registration, Login, Profile
    │   ├── branchController.js                       # Multi-branch CRUD
    │   ├── tableController.js                        # Table inventory management
    │   ├── menuController.js                         # Menu catalog & availability toggle
    │   ├── reservationController.js                  # Slot availability & booking engine
    │   ├── orderController.js                        # Food order placement & lifecycle
    │   ├── kitchenController.js                      # Kitchen queue & status advancement
    │   ├── billingController.js                      # Bill calculation, discount & payments
    │   ├── customerController.js                     # Customer order & reservation history
    │   ├── feedbackController.js                     # Customer reviews & rating stats
    │   └── analyticsController.js                    # Business intelligence aggregation pipelines
    ├── routes/
    │   ├── authRoutes.js
    │   ├── branchRoutes.js
    │   ├── tableRoutes.js
    │   ├── menuRoutes.js
    │   ├── reservationRoutes.js
    │   ├── orderRoutes.js
    │   ├── kitchenRoutes.js
    │   ├── billingRoutes.js
    │   ├── customerRoutes.js
    │   ├── feedbackRoutes.js
    │   └── analyticsRoutes.js
    ├── utils/
    │   ├── AppError.js                               # Standardized operational error class
    │   ├── asyncHandler.js                           # Async try-catch wrapper
    │   └── billCalculator.js                         # Tax, discount, and total computation
    └── seed/
        └── seeder.js                                 # Comprehensive database seeding script
```

---

## 👥 User Roles & Access Control Matrix

| Feature / Action | Public | Customer | Kitchen Staff | Manager | Admin |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Sign-up / Login | ✅ | ✅ | ✅ | ✅ | ✅ |
| Browse Branches, Menu & Reviews | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manage Branches (CRUD) | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage Table Inventory | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage Menu Items (CRUD) | ❌ | ❌ | ❌ | ✅ | ✅ |
| Toggle Menu Item Availability | ❌ | ❌ | ✅ | ✅ | ✅ |
| Check Slot Availability | ✅ | ✅ | ❌ | ✅ | ✅ |
| Book / Reschedule / Cancel Table | ❌ | ✅ (Own) | ❌ | ✅ | ✅ |
| Place Food Orders | ❌ | ✅ | ❌ | ✅ | ✅ |
| Kitchen Display Queue & Advance Workflow | ❌ | ❌ | ✅ | ✅ | ✅ |
| View Bills & Pay for Order | ❌ | ✅ (Own) | ❌ | ✅ | ✅ |
| Apply Manager Discount | ❌ | ❌ | ❌ | ✅ | ✅ |
| Customer Order & Reservation History | ❌ | ✅ (Own) | ❌ | ✅ | ✅ |
| Submit Ratings & Feedback | ❌ | ✅ | ❌ | ❌ | ❌ |
| Executive Analytics & Reports | ❌ | ❌ | ❌ | ✅ | ✅ |

---

## 📋 13 Functional Modules Specification

### 1. Customer Registration & Authentication
- `POST /api/auth/register` — Register a customer account with hashed password.
- `POST /api/auth/login` — Authenticate and receive a signed JWT token.
- `GET /api/auth/me` — Retrieve current authenticated user profile (`Bearer <token>`).
- `PUT /api/auth/profile` — Update customer contact details.

### 2. Branch Management
- `GET /api/branches` — List all active branches with opening/closing hours.
- `GET /api/branches/:id` — Get single branch details.
- `POST /api/branches` — Create a new branch (*Admin/Manager*).
- `PUT /api/branches/:id` — Update branch details (*Admin/Manager*).
- `DELETE /api/branches/:id` — Remove branch (*Admin*).

### 3. Menu Management
- `GET /api/menu` — List menu items with filters (`category`, `dietary`, `search`, `branchId`, `minPrice`, `maxPrice`).
- `GET /api/menu/:id` — Get single menu item.
- `POST /api/menu` — Add a new menu dish (*Admin/Manager*).
- `PUT /api/menu/:id` — Update dish details (*Admin/Manager*).
- `PATCH /api/menu/:id/toggle-availability` — 1-click toggle between Available / Sold Out (*Kitchen Staff/Manager/Admin*).
- `DELETE /api/menu/:id` — Delete menu item (*Admin/Manager*).

### 4. Table Inventory Management
- `GET /api/tables?branchId=...` — View tables categorized by seating capacity (2, 4, 6, 8) and location (Indoor, Outdoor, Rooftop, Private).
- `POST /api/tables` — Add table to a branch (*Admin/Manager*).
- `PUT /api/tables/:id` — Update table capacity or status (*Admin/Manager*).
- `DELETE /api/tables/:id` — Delete table (*Admin/Manager*).

### 5. Table Reservation Engine (Anti-Collision Slot System)
- `GET /api/reservations/availability?branchId=...&date=YYYY-MM-DD` — Real-time availability breakdown across operating slots.
- `POST /api/reservations` — Book a table for a date and time slot (Strict double-booking prevention).
- `GET /api/reservations` — View customer's reservations or all reservations for staff.
- `GET /api/reservations/:id` — Detailed reservation view.

### 6. Food Order Placement
- `POST /api/orders` — Place Dine-in (linked to table/reservation) or Takeaway order with item customizations.
- `GET /api/orders/:id` — Get order status and item snapshots.
- `GET /api/orders` — List orders filtered by branch, status, or date.
- `PATCH /api/orders/:id/cancel` — Cancel order (permitted only while in `PLACED` state).

### 7. Order Status Workflow
- `PATCH /api/orders/:id/status` — Advance status (`PLACED` ➔ `PREPARING` ➔ `READY` ➔ `SERVED` ➔ `COMPLETED`).

### 8. Kitchen Display Queue APIs
- `GET /api/kitchen/queue?branchId=...` — Live kitchen order queue sorted by elapsed time (FIFO).
- `PATCH /api/kitchen/orders/:id/advance` — Fast 1-click status advance for kitchen screen.
- `PATCH /api/kitchen/orders/:orderId/items/:itemId` — Update individual dish cooking status.

### 9. Billing & Order Summary
- `GET /api/billing/:orderId` — Full itemized tax receipt with subtotal, 5% GST, 5% service charge, and discounts.
- `POST /api/billing/:orderId/pay` — Process payment (`CASH`, `CARD`, `UPI`, `ONLINE`) and generate receipt.
- `PATCH /api/billing/:orderId/discount` — Apply percentage discount (*Manager/Admin*).

### 10. Reservation Cancellation & Rescheduling Policy
- `PATCH /api/reservations/:id/cancel` — Cancel reservation (enforces 2-hour minimum lead time policy for customers).
- `PATCH /api/reservations/:id/reschedule` — Move reservation to a new slot with conflict re-validation.

### 11. Customer History & Profile
- `GET /api/customers/history/orders` — Customer's past orders with receipt links.
- `GET /api/customers/history/reservations` — Past and upcoming bookings.
- `GET /api/customers/summary` — Total visits, completed orders, and lifetime expenditure.

### 12. Feedback & Rating Module
- `POST /api/feedback` — Submit overall rating (1-5), sub-ratings (Food, Service, Ambience), and review comments.
- `GET /api/feedback?branchId=...` — Public reviews for a branch.
- `GET /api/feedback/stats?branchId=...` — Average ratings and star distribution breakdown.

### 13. Manager Reports & Business Analytics
- `GET /api/analytics/overview` — High-level KPI metrics (total revenue, active customers, total bookings).
- `GET /api/analytics/popular-dishes` — Top-selling dishes by volume and revenue generated.
- `GET /api/analytics/peak-hours` — Hourly traffic breakdown for dining slots and food orders.
- `GET /api/analytics/revenue-by-branch` — Comparative revenue, taxes, and order counts per branch.
- `GET /api/analytics/reservation-occupancy` — Seating occupancy and cancellation rates.

---

## ⚡ Quick Start & Setup Guide

### 1. Prerequisites
- **Node.js** (v18.0.0 or higher)
- **MongoDB** (Local daemon running on `mongodb://127.0.0.1:27017` or MongoDB Atlas URI)

### 2. Installation
```bash
# Clone the repository
git clone <repo-url>
cd cia3-foodreservation

# Install all dependencies
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory (or copy from `.env.example`):
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/restaurant_db
JWT_SECRET=super_secret_jwt_key_cia3_food_reservation_2026
JWT_EXPIRES_IN=7d
TAX_RATE_PERCENT=5
SERVICE_CHARGE_PERCENT=5
CANCELLATION_DEADLINE_HOURS=2
DEFAULT_SLOT_DURATION_MINUTES=90
```

### 4. Database Seeding
Populate branches, tables, menu items, sample users, reservations, orders, and feedback:
```bash
npm run seed
```

### 5. Start the Server
```bash
# Production / standard mode
npm start

# Development mode (with auto-reload)
npm run dev
```
The API server will launch at: `http://localhost:5000`

### 6. Run Automated Test Verification
```bash
npm test
```

---

## 🔑 Pre-Seeded Test Credentials

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@restaurant.com` | `Admin@123Password` | Full system access, branch creation, analytics |
| **Manager** | `manager@restaurant.com` | `Manager@123Password` | Menu CRUD, table inventory, discounts, analytics |
| **Kitchen Staff** | `kitchen@restaurant.com` | `Kitchen@123Password` | Live kitchen queue, status advancement, availability toggle |
| **Customer 1** | `rahul@gmail.com` | `Customer@123Password` | Booking tables, ordering food, viewing history, feedback |
| **Customer 2** | `priya@gmail.com` | `Customer@123Password` | Booking tables, ordering food, viewing history, feedback |

---

## 📮 Postman Collection Usage

1. Open **Postman**.
2. Click **Import** ➔ select [`postman/Restaurant_Reservation_and_Ordering_API.postman_collection.json`](file:///c:/Users/Knight%20Tourism/Documents/lt_sem5/cia3-foodreservation/postman/Restaurant_Reservation_and_Ordering_API.postman_collection.json).
3. The collection includes pre-written tests that automatically extract JWT tokens (`customerToken`, `managerToken`, `kitchenToken`, `adminToken`) upon calling the login endpoints.
4. Execute the requests sequentially or run the full folder collection with Postman Runner!
