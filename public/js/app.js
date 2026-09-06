/**
 * THE ROYAL FEAST - CLIENT APP LOGIC
 */

// App State
const state = {
  currentUser: {
    name: 'Rahul Sharma',
    email: 'rahul@gmail.com',
    role: 'customer',
    token: ''
  },
  branches: [],
  selectedBranchId: '',
  menuItems: [],
  activeCategory: 'ALL',
  activeDietary: null,
  cart: [],
  tables: [],
  selectedTableId: null,
  kitchenOrders: [],
  customerOrders: [],
  customerReservations: []
};

// Demo user credentials
const DEMO_USERS = {
  customer: { email: 'rahul@gmail.com', password: 'Customer@123Password', name: 'Rahul Sharma (Customer)', role: 'customer' },
  priya: { email: 'priya@gmail.com', password: 'Customer@123Password', name: 'Priya Patel (Customer)', role: 'customer' },
  kitchen: { email: 'kitchen@restaurant.com', password: 'Kitchen@123Password', name: 'Head Chef Suresh (Kitchen)', role: 'kitchen_staff' },
  manager: { email: 'manager@restaurant.com', password: 'Manager@123Password', name: 'Branch Manager', role: 'manager' },
  admin: { email: 'admin@restaurant.com', password: 'Admin@123Password', name: 'System Administrator (Admin)', role: 'admin' }
};

// =========================================================================
// INITIALIZATION
// =========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  // Set default reservation date to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateInput = document.getElementById('resv-date');
  if (dateInput) {
    dateInput.value = tomorrow.toISOString().split('T')[0];
    dateInput.min = new Date().toISOString().split('T')[0];
  }

  // Load public catalogs
  await loadBranches();
  await loadMenu();
  await loadTables();

  // Login as default customer Rahul (switchRole loads relevant data)
  await switchRole('customer');

  // Periodically refresh kitchen queue only for kitchen staff/managers/admins
  setInterval(() => {
    if (['kitchen_staff', 'manager', 'admin'].includes(state.currentUser.role)) {
      loadKitchenQueue();
    }
  }, 10000);
});

// =========================================================================
// TOAST NOTIFICATIONS
// =========================================================================
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : '⚠️'}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}

// =========================================================================
// API HELPER
// =========================================================================
async function apiRequest(endpoint, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.currentUser.token) {
    headers['Authorization'] = `Bearer ${state.currentUser.token}`;
  }

  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(endpoint, options);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'API request failed');
    }
    return data;
  } catch (err) {
    console.error('API Error:', err);
    showToast(err.message, 'error');
    throw err;
  }
}

// =========================================================================
// ROLE SWITCHER
// =========================================================================
async function switchRole(roleKey) {
  const userCred = DEMO_USERS[roleKey];
  if (!userCred) return;

  try {
    const res = await apiRequest('/api/auth/login', 'POST', {
      email: userCred.email,
      password: userCred.password
    });

    state.currentUser = {
      name: userCred.name,
      email: userCred.email,
      role: res.data.user.role,
      token: res.data.token
    };

    document.getElementById('current-user-badge').innerHTML = `Logged in as: <strong>${userCred.name}</strong>`;
    
    // Update button active state
    document.querySelectorAll('.role-pill-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`btn-role-${roleKey}`);
    if (activeBtn) activeBtn.classList.add('active');

    showToast(`Switched active role to: ${userCred.name}`);

    // Refresh views based on active role
    if (state.currentUser.role === 'customer') {
      loadCustomerOrders();
      loadCustomerReservations();
    } else if (state.currentUser.role === 'kitchen_staff') {
      loadKitchenQueue();
    } else if (['manager', 'admin'].includes(state.currentUser.role)) {
      loadKitchenQueue();
      loadAnalytics();
      loadCustomerOrders();
      loadCustomerReservations();
    }
  } catch (err) {
    console.warn('Role switch login error:', err);
  }
}

// =========================================================================
// NAVIGATION TABS
// =========================================================================
function switchTab(tabId) {
  document.querySelectorAll('.tab-view').forEach(view => view.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

  const targetView = document.getElementById(`view-${tabId}`);
  const targetNav = document.getElementById(`nav-${tabId}`);

  if (targetView) targetView.classList.add('active');
  if (targetNav) targetNav.classList.add('active');

  if (tabId === 'kitchen') {
    if (!['kitchen_staff', 'manager', 'admin'].includes(state.currentUser.role)) {
      showToast('⚠️ Switch to Kitchen Staff, Manager, or Admin above to use the Kitchen Queue', 'error');
    } else {
      loadKitchenQueue();
    }
  }
  if (tabId === 'orders') {
    loadCustomerOrders();
    loadCustomerReservations();
  }
  if (tabId === 'analytics') {
    if (!['manager', 'admin'].includes(state.currentUser.role)) {
      showToast('⚠️ Switch to Manager or Admin above to view live Business Analytics', 'error');
    } else {
      loadAnalytics();
    }
  }
  if (tabId === 'reservation') onResvParamChange();
}

// =========================================================================
// BRANCHES & MENU
// =========================================================================
async function loadBranches() {
  try {
    const res = await apiRequest('/api/branches');
    state.branches = res.data.branches;
    if (state.branches.length > 0) {
      state.selectedBranchId = state.branches[0]._id;
    }

    const branchSelect = document.getElementById('branch-select');
    const resvBranchSelect = document.getElementById('resv-branch-select');

    const optionsHtml = state.branches.map(b => `<option value="${b._id}">${b.name} (${b.address.city})</option>`).join('');

    if (branchSelect) branchSelect.innerHTML = optionsHtml;
    if (resvBranchSelect) resvBranchSelect.innerHTML = optionsHtml;
  } catch (err) {}
}

function onBranchChange() {
  state.selectedBranchId = document.getElementById('branch-select').value;
  loadMenu();
  loadTables();
}

async function loadMenu() {
  try {
    const res = await apiRequest(`/api/menu?branchId=${state.selectedBranchId}`);
    state.menuItems = res.data.menuItems;
    renderMenu();
  } catch (err) {}
}

function renderMenu() {
  const container = document.getElementById('menu-grid-container');
  if (!container) return;

  const searchQuery = (document.getElementById('menu-search-input').value || '').toLowerCase();

  const filtered = state.menuItems.filter(item => {
    const matchesCat = state.activeCategory === 'ALL' || item.category === state.activeCategory;
    const matchesDiet = !state.activeDietary || item.dietary === state.activeDietary;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery) || item.description.toLowerCase().includes(searchQuery);
    return matchesCat && matchesDiet && matchesSearch;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">No dishes match your selected filters.</div>`;
    return;
  }

  container.innerHTML = filtered.map(item => `
    <div class="menu-card">
      <div class="menu-card-img-wrap">
        <img class="menu-card-img" src="${item.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80'}" alt="${item.name}" loading="lazy">
        <span class="dietary-tag tag-${item.dietary}">${item.dietary}</span>
        <span class="prep-time-tag">⏱️ ${item.preparationTimeMinutes || 15}m</span>
      </div>
      <div class="menu-card-body">
        <span class="menu-item-cat">${item.category}</span>
        <h3 class="menu-item-title">${item.name}</h3>
        <p class="menu-item-desc">${item.description}</p>
        <div class="menu-card-footer">
          <span class="menu-item-price">₹${item.price}</span>
          <button class="add-cart-btn" onclick="addToCart('${item._id}')">
            <span>+</span> Add to Order
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

function selectCategory(cat) {
  state.activeCategory = cat;
  document.querySelectorAll('.category-pill').forEach(pill => {
    pill.classList.toggle('active', pill.textContent.includes(cat) || (cat === 'ALL' && pill.textContent.includes('All')));
  });
  renderMenu();
}

function toggleDietaryFilter(diet) {
  if (state.activeDietary === diet) {
    state.activeDietary = null;
    document.getElementById(`filter-${diet}`).classList.remove('active');
  } else {
    state.activeDietary = diet;
    document.querySelectorAll('.dietary-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`filter-${diet}`).classList.add('active');
  }
  renderMenu();
}

function filterMenu() {
  renderMenu();
}

// =========================================================================
// CART & ORDERING
// =========================================================================
function addToCart(itemId) {
  const menuItem = state.menuItems.find(i => i._id === itemId);
  if (!menuItem) return;

  const existing = state.cart.find(i => i.menuItemId === itemId);
  if (existing) {
    existing.quantity++;
  } else {
    state.cart.push({
      menuItemId: menuItem._id,
      name: menuItem.name,
      price: menuItem.price,
      quantity: 1,
      specialInstructions: ''
    });
  }

  updateCartUI();
  showToast(`Added "${menuItem.name}" to cart`);
}

function updateCartQty(itemId, delta) {
  const item = state.cart.find(i => i.menuItemId === itemId);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    state.cart = state.cart.filter(i => i.menuItemId !== itemId);
  }

  updateCartUI();
}

function updateCartUI() {
  const totalCount = state.cart.reduce((acc, curr) => acc + curr.quantity, 0);
  const badge = document.getElementById('cart-badge-count');
  if (badge) badge.textContent = totalCount;

  const container = document.getElementById('cart-items-container');
  if (!container) return;

  if (state.cart.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:40px 0; color:var(--text-muted);">Your food cart is empty.<br>Browse our menu and add some dishes!</div>`;
  } else {
    container.innerHTML = state.cart.map(item => `
      <div class="cart-item">
        <div class="cart-item-info">
          <div style="font-weight:600; font-size:0.95rem;">${item.name}</div>
          <div style="color:var(--accent-gold); font-size:0.85rem;">₹${item.price} each</div>
        </div>
        <div class="qty-control">
          <button class="qty-btn" onclick="updateCartQty('${item.menuItemId}', -1)">-</button>
          <span style="font-weight:700; font-size:0.9rem;">${item.quantity}</span>
          <button class="qty-btn" onclick="updateCartQty('${item.menuItemId}', 1)">+</button>
        </div>
      </div>
    `).join('');
  }

  // Compute Bill Summary
  const subtotal = state.cart.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
  const tax = Number((subtotal * 0.05).toFixed(2));
  const serviceCharge = Number((subtotal * 0.05).toFixed(2));
  const grandTotal = Number((subtotal + tax + serviceCharge).toFixed(2));

  document.getElementById('cart-subtotal').textContent = `₹${subtotal.toFixed(2)}`;
  document.getElementById('cart-tax').textContent = `₹${tax.toFixed(2)}`;
  document.getElementById('cart-service-charge').textContent = `₹${serviceCharge.toFixed(2)}`;
  document.getElementById('cart-grand-total').textContent = `₹${grandTotal.toFixed(2)}`;
}

function toggleCartDrawer(open) {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-overlay');
  if (open) {
    drawer.classList.add('active');
    overlay.classList.add('active');
  } else {
    drawer.classList.remove('active');
    overlay.classList.remove('active');
  }
}

function onCartOrderTypeChange() {
  const type = document.getElementById('cart-order-type').value;
  const tableWrap = document.getElementById('cart-table-select-wrap');
  if (tableWrap) {
    tableWrap.style.display = type === 'DINE_IN' ? 'block' : 'none';
  }
}

async function checkoutOrder() {
  if (state.cart.length === 0) {
    showToast('Please add items to your cart first.', 'error');
    return;
  }

  const orderType = document.getElementById('cart-order-type').value;
  const tableSelect = document.getElementById('cart-table-select');
  const tableId = orderType === 'DINE_IN' && tableSelect ? tableSelect.value : null;

  try {
    const payload = {
      branchId: state.selectedBranchId,
      orderType,
      tableId,
      items: state.cart.map(i => ({
        menuItemId: i.menuItemId,
        quantity: i.quantity,
        specialInstructions: i.specialInstructions
      })),
      notes: 'Web order checkout'
    };

    const res = await apiRequest('/api/orders', 'POST', payload);
    showToast('🎉 Order placed successfully! Sent to kitchen queue.');
    state.cart = [];
    updateCartUI();
    toggleCartDrawer(false);

    // Refresh orders and kitchen queue
    loadCustomerOrders();
    loadKitchenQueue();
    switchTab('orders');
  } catch (err) {}
}

// =========================================================================
// TABLE RESERVATIONS
// =========================================================================
async function loadTables() {
  try {
    const branchId = state.selectedBranchId;
    const res = await apiRequest(`/api/tables?branchId=${branchId}`);
    state.tables = res.data.tables;

    // Populate cart table selector
    const cartTableSelect = document.getElementById('cart-table-select');
    if (cartTableSelect) {
      cartTableSelect.innerHTML = state.tables.map(t => `<option value="${t._id}">Table ${t.tableNumber} (${t.location} - ${t.capacity} seater)</option>`).join('');
    }

    renderTableFloorPlan();
  } catch (err) {}
}

async function onResvParamChange() {
  const branchId = document.getElementById('resv-branch-select').value;
  const date = document.getElementById('resv-date').value;
  const startTime = document.getElementById('resv-time').value;
  const partySize = document.getElementById('resv-guests').value;

  if (!branchId || !date || !startTime) return;

  try {
    const res = await apiRequest(`/api/reservations/availability?branchId=${branchId}&date=${date}&startTime=${startTime}&partySize=${partySize}`);
    const availableTableIds = new Set((res.data.availableTables || []).map(t => t._id));

    renderTableFloorPlan(availableTableIds);
  } catch (err) {
    renderTableFloorPlan();
  }
}

function renderTableFloorPlan(availableSet = null) {
  const container = document.getElementById('tables-grid-container');
  if (!container) return;

  container.innerHTML = state.tables.map(table => {
    const isAvailable = availableSet ? availableSet.has(table._id) : true;
    const isSelected = state.selectedTableId === table._id;
    const statusClass = isSelected ? 'selected' : (isAvailable ? 'available' : 'occupied');

    return `
      <div class="table-box ${statusClass}" onclick="${isAvailable ? `selectTable('${table._id}', '${table.tableNumber}', ${table.capacity})` : ''}">
        <div class="table-box-number">Table ${table.tableNumber}</div>
        <div class="table-box-capacity">👥 ${table.capacity} Seater</div>
        <span class="table-box-zone">${table.location.replace('_', ' ')}</span>
        <div style="font-size:0.75rem; margin-top:6px; font-weight:700; color:${isAvailable ? 'var(--color-success)' : 'var(--color-danger)'};">
          ${isSelected ? 'Selected' : (isAvailable ? '● Available' : '✕ Reserved')}
        </div>
      </div>
    `;
  }).join('');
}

function selectTable(id, number, capacity) {
  state.selectedTableId = id;
  const label = document.getElementById('resv-selected-table-label');
  const hidden = document.getElementById('resv-selected-table-id');
  if (label) label.value = `Table ${number} (${capacity} guests)`;
  if (hidden) hidden.value = id;

  renderTableFloorPlan();
  showToast(`Selected Table ${number}`);
}

async function submitReservation() {
  const branchId = document.getElementById('resv-branch-select').value;
  const tableId = document.getElementById('resv-selected-table-id').value;
  const reservationDate = document.getElementById('resv-date').value;
  const startTime = document.getElementById('resv-time').value;
  const partySize = Number(document.getElementById('resv-guests').value);
  const specialRequests = document.getElementById('resv-special').value;

  if (!tableId) {
    showToast('Please select an available table from the floor plan.', 'error');
    return;
  }

  try {
    const payload = {
      branchId,
      tableId,
      partySize,
      reservationDate,
      startTime,
      durationMinutes: 90,
      specialRequests
    };

    const res = await apiRequest('/api/reservations', 'POST', payload);
    showToast('✨ Table booked successfully! Confirmation created.');

    // Reset table selection and refresh
    state.selectedTableId = null;
    document.getElementById('resv-selected-table-label').value = 'Select a table from floor plan';
    document.getElementById('resv-selected-table-id').value = '';

    onResvParamChange();
    loadCustomerReservations();
    switchTab('orders');
  } catch (err) {}
}

async function cancelReservation(reservationId) {
  if (!confirm('Are you sure you want to cancel this reservation?')) return;

  try {
    await apiRequest(`/api/reservations/${reservationId}/cancel`, 'PATCH', {
      cancellationReason: 'Cancelled via customer portal'
    });
    showToast('Reservation cancelled successfully. Table freed.');
    loadCustomerReservations();
    onResvParamChange();
  } catch (err) {}
}

// =========================================================================
// KITCHEN DISPLAY QUEUE
// =========================================================================
async function loadKitchenQueue() {
  if (!['kitchen_staff', 'manager', 'admin'].includes(state.currentUser?.role)) {
    return;
  }
  try {
    const res = await apiRequest(`/api/kitchen/queue?branchId=${state.selectedBranchId}`);
    state.kitchenOrders = res.data.queue;

    const countBadge = document.getElementById('nav-kitchen-count');
    if (countBadge) countBadge.textContent = state.kitchenOrders.length;

    const placedOrders = state.kitchenOrders.filter(o => o.status === 'PLACED');
    const prepOrders = state.kitchenOrders.filter(o => o.status === 'PREPARING');
    const readyOrders = state.kitchenOrders.filter(o => o.status === 'READY');

    document.getElementById('col-count-placed').textContent = placedOrders.length;
    document.getElementById('col-count-preparing').textContent = prepOrders.length;
    document.getElementById('col-count-ready').textContent = readyOrders.length;

    renderKanbanColumn('kanban-placed-container', placedOrders, 'Start Cooking ➔');
    renderKanbanColumn('kanban-preparing-container', prepOrders, 'Mark Ready ➔');
    renderKanbanColumn('kanban-ready-container', readyOrders, 'Mark Served ➔');
  } catch (err) {}
}

function renderKanbanColumn(containerId, orders, btnLabel) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (orders.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted); font-size:0.85rem;">No active tickets</div>`;
    return;
  }

  container.innerHTML = orders.map(order => `
    <div class="kitchen-ticket ${order.isDelayed ? 'delayed' : ''}">
      <div class="ticket-top">
        <span class="ticket-number">${order.orderNumber}</span>
        <span class="ticket-timer">⏱️ ${order.elapsedMinutes}m ago</span>
      </div>
      <div style="font-size:0.8rem; color:var(--text-secondary);">
        ${order.orderType === 'DINE_IN' ? `🪑 Table ${order.table ? order.table.tableNumber : 'N/A'}` : '🛍️ Takeaway'} • ${order.customer ? order.customer.name : 'Guest'}
      </div>
      <ul class="ticket-items-list">
        ${order.items.map(i => `
          <li class="ticket-item">
            <span><strong>${i.quantity}x</strong> ${i.name}</span>
            <span style="font-size:0.75rem; color:var(--accent-gold);">${i.itemStatus}</span>
          </li>
        `).join('')}
      </ul>
      ${order.notes ? `<div style="font-size:0.75rem; color:var(--text-muted); font-style:italic;">Note: "${order.notes}"</div>` : ''}
      <button class="ticket-advance-btn" onclick="advanceKitchenTicket('${order.orderId}')">
        ${btnLabel}
      </button>
    </div>
  `).join('');
}

async function advanceKitchenTicket(orderId) {
  try {
    await apiRequest(`/api/kitchen/orders/${orderId}/advance`, 'PATCH');
    showToast('Kitchen ticket advanced to next stage');
    loadKitchenQueue();
    loadCustomerOrders();
  } catch (err) {}
}

// =========================================================================
// CUSTOMER ORDERS, BILLING & INVOICES
// =========================================================================
async function loadCustomerOrders() {
  try {
    const res = await apiRequest('/api/customers/history/orders');
    state.customerOrders = res.data.orders;

    const tbody = document.getElementById('customer-orders-tbody');
    if (!tbody) return;

    if (state.customerOrders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">No orders placed yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = state.customerOrders.map(order => `
      <tr>
        <td><strong>${order.orderNumber}</strong><br><small style="color:var(--text-muted);">${new Date(order.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</small></td>
        <td>${order.branchId ? order.branchId.name : 'Branch'}<br><small style="color:var(--text-secondary);">${order.tableId ? `Table ${order.tableId.tableNumber}` : 'Takeaway'}</small></td>
        <td>${order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}</td>
        <td><strong>₹${order.billing ? order.billing.grandTotal : 0}</strong></td>
        <td><span class="status-badge status-${order.status}">${order.status}</span></td>
        <td>
          <span style="font-weight:700; font-size:0.8rem; color:${order.billing && order.billing.paymentStatus === 'PAID' ? 'var(--color-success)' : 'var(--accent-gold)'};">
            ${order.billing ? order.billing.paymentStatus : 'UNPAID'}
          </span>
        </td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="action-btn-sm" onclick="viewInvoice('${order._id}')">📄 Bill</button>
            ${order.billing && order.billing.paymentStatus === 'UNPAID' ? `<button class="action-btn-sm" style="background:var(--accent-gold-gradient); color:#000; font-weight:700;" onclick="payOrderPrompt('${order._id}')">💳 Pay</button>` : ''}
            ${order.status === 'COMPLETED' ? `<button class="action-btn-sm" onclick="openFeedbackModal('${order._id}', '${order.branchId ? order.branchId._id : ''}')">⭐ Rate</button>` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {}
}

async function loadCustomerReservations() {
  try {
    const res = await apiRequest('/api/customers/history/reservations');
    state.customerReservations = res.data.reservations;

    const tbody = document.getElementById('customer-reservations-tbody');
    if (!tbody) return;

    if (state.customerReservations.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text-muted);">No table reservations found.</td></tr>`;
      return;
    }

    tbody.innerHTML = state.customerReservations.map(resv => `
      <tr>
        <td><strong>${resv.branchId ? resv.branchId.name : 'Branch'}</strong></td>
        <td>Table ${resv.tableId ? resv.tableId.tableNumber : 'N/A'} (${resv.tableId ? resv.tableId.location : ''})</td>
        <td>📅 ${resv.reservationDate} <br> ⏰ ${resv.timeSlot ? `${resv.timeSlot.startTime} - ${resv.timeSlot.endTime}` : ''}</td>
        <td>👥 ${resv.partySize} Guests</td>
        <td><span class="status-badge status-${resv.status}">${resv.status}</span></td>
        <td>
          ${resv.status === 'CONFIRMED' ? `<button class="action-btn-sm" style="border-color:var(--color-danger); color:var(--color-danger);" onclick="cancelReservation('${resv._id}')">Cancel</button>` : '<span style="color:var(--text-muted); font-size:0.8rem;">-</span>'}
        </td>
      </tr>
    `).join('');
  } catch (err) {}
}

async function viewInvoice(orderId) {
  try {
    const res = await apiRequest(`/api/billing/${orderId}`);
    const invoice = res.data.invoice;

    const modalBody = document.getElementById('invoice-body');
    modalBody.innerHTML = `
      <div style="border-bottom:1px solid var(--border-color); padding-bottom:12px; margin-bottom:16px; text-align:center;">
        <h2 style="font-family:var(--font-heading); font-size:1.4rem;">${invoice.restaurant.branchName}</h2>
        <div style="font-size:0.85rem; color:var(--text-secondary);">${invoice.restaurant.address ? `${invoice.restaurant.address.street}, ${invoice.restaurant.address.city}` : ''}</div>
        <div style="font-size:0.8rem; color:var(--accent-gold); margin-top:4px;">Invoice: ${invoice.invoiceNumber}</div>
      </div>

      <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:12px;">
        <span><strong>Customer:</strong> ${invoice.customer.name}</span>
        <span><strong>Order:</strong> ${invoice.orderNumber}</span>
      </div>
      <div style="font-size:0.85rem; margin-bottom:16px; color:var(--text-secondary);">
        Dining Option: <strong>${invoice.orderType}</strong> • Location: <strong>${invoice.table}</strong>
      </div>

      <table style="width:100%; font-size:0.85rem; border-collapse:collapse; margin-bottom:16px;">
        <thead>
          <tr style="border-bottom:1px solid var(--border-color); text-align:left;">
            <th style="padding:6px 0;">Item</th>
            <th style="text-align:center;">Qty</th>
            <th style="text-align:right;">Price</th>
            <th style="text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${invoice.items.map(i => `
            <tr style="border-bottom:1px dashed rgba(255,255,255,0.06);">
              <td style="padding:8px 0;">${i.name}</td>
              <td style="text-align:center;">${i.quantity}</td>
              <td style="text-align:right;">₹${i.unitPrice}</td>
              <td style="text-align:right; font-weight:600;">₹${i.itemTotal}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="border-top:1px solid var(--border-color); padding-top:12px;">
        <div class="bill-line"><span>Subtotal</span><span>₹${invoice.breakdown.subtotal.toFixed(2)}</span></div>
        ${invoice.breakdown.discountAmount > 0 ? `<div class="bill-line" style="color:var(--color-success);"><span>Discount (${invoice.breakdown.discountPercent}%)</span><span>-₹${invoice.breakdown.discountAmount.toFixed(2)}</span></div>` : ''}
        <div class="bill-line"><span>GST Tax (${invoice.breakdown.taxRatePercent}%)</span><span>₹${invoice.breakdown.taxAmount.toFixed(2)}</span></div>
        <div class="bill-line"><span>Service Charge (${invoice.breakdown.serviceChargeRatePercent}%)</span><span>₹${invoice.breakdown.serviceChargeAmount.toFixed(2)}</span></div>
        <div class="bill-total-line"><span>Grand Total</span><span style="color:var(--accent-gold);">₹${invoice.breakdown.grandTotal.toFixed(2)}</span></div>
      </div>

      <div style="margin-top:20px; text-align:center; padding:12px; background:var(--bg-primary); border-radius:var(--radius-sm); font-size:0.85rem;">
        Payment Status: <strong style="color:${invoice.payment.status === 'PAID' ? 'var(--color-success)' : 'var(--accent-gold)'};">${invoice.payment.status}</strong> 
        ${invoice.payment.method !== 'PENDING' ? `via ${invoice.payment.method}` : ''}
      </div>

      ${invoice.payment.status === 'UNPAID' ? `
        <button class="form-btn" style="margin-top:16px;" onclick="payOrderPrompt('${orderId}')">💳 Pay Bill (₹${invoice.breakdown.grandTotal})</button>
      ` : ''}
    `;

    document.getElementById('invoice-modal').classList.add('active');
  } catch (err) {}
}

function closeInvoiceModal() {
  document.getElementById('invoice-modal').classList.remove('active');
}

async function payOrderPrompt(orderId) {
  try {
    await apiRequest(`/api/billing/${orderId}/pay`, 'POST', {
      paymentMethod: 'UPI',
      transactionRef: `UPI-ONLINE-${Date.now()}`
    });
    showToast('Payment successful! Receipt generated.');
    closeInvoiceModal();
    loadCustomerOrders();
    loadAnalytics();
  } catch (err) {}
}

// =========================================================================
// FEEDBACK & RATINGS
// =========================================================================
function openFeedbackModal(orderId, branchId) {
  document.getElementById('feedback-order-id').value = orderId;
  document.getElementById('feedback-branch-id').value = branchId || state.selectedBranchId;
  document.getElementById('feedback-modal').classList.add('active');
}

function closeFeedbackModal() {
  document.getElementById('feedback-modal').classList.remove('active');
}

async function submitFeedbackForm() {
  const orderId = document.getElementById('feedback-order-id').value;
  const branchId = document.getElementById('feedback-branch-id').value;
  const rating = Number(document.getElementById('feedback-rating').value);
  const foodRating = Number(document.getElementById('feedback-food-rating').value);
  const serviceRating = Number(document.getElementById('feedback-service-rating').value);
  const comment = document.getElementById('feedback-comment').value;

  try {
    await apiRequest('/api/feedback', 'POST', {
      branchId,
      orderId,
      rating,
      foodRating,
      serviceRating,
      comment
    });

    showToast('🌟 Thank you for your dining review!');
    closeFeedbackModal();
  } catch (err) {}
}

// =========================================================================
// MANAGER ANALYTICS & REPORTS
// =========================================================================
async function loadAnalytics() {
  if (!['manager', 'admin'].includes(state.currentUser?.role)) {
    return;
  }
  try {
    const [overview, popular, revBranch] = await Promise.all([
      apiRequest('/api/analytics/overview'),
      apiRequest('/api/analytics/popular-dishes'),
      apiRequest('/api/analytics/revenue-by-branch')
    ]);

    const m = overview.data.metrics;
    document.getElementById('kpi-total-revenue').textContent = `₹${(m.orders.totalRevenue || 0).toLocaleString()}`;
    document.getElementById('kpi-completed-orders').textContent = m.orders.completed || 0;
    document.getElementById('kpi-avg-order').textContent = `₹${m.orders.averageOrderValue || 0}`;
    document.getElementById('kpi-reservations').textContent = m.reservations.total || 0;

    // Popular Dishes list
    const dishesContainer = document.getElementById('popular-dishes-list');
    if (dishesContainer) {
      const dishes = popular.data.popularDishes || [];
      const maxQty = dishes.length > 0 ? dishes[0].totalQuantitySold : 1;

      dishesContainer.innerHTML = dishes.map((d, i) => `
        <li class="rank-item">
          <div style="flex:1;">
            <div style="display:flex; justify-content:space-between;">
              <span><strong>#${i + 1} ${d.dishName}</strong></span>
              <span><strong>${d.totalQuantitySold} sold</strong> (₹${d.totalRevenue})</span>
            </div>
            <div class="rank-progress-bar">
              <div class="rank-progress-fill" style="width: ${(d.totalQuantitySold / maxQty) * 100}%;"></div>
            </div>
          </div>
        </li>
      `).join('');
    }

    // Branch Revenue
    const branchContainer = document.getElementById('branch-revenue-list');
    if (branchContainer) {
      const branches = revBranch.data.branchRevenue || [];
      branchContainer.innerHTML = branches.map(b => `
        <li class="rank-item">
          <div style="flex:1;">
            <div style="display:flex; justify-content:space-between;">
              <span><strong>${b.branchName}</strong> (${b.city})</span>
              <span style="color:var(--accent-gold);"><strong>₹${b.totalRevenue.toLocaleString()}</strong> (${b.totalOrders} orders)</span>
            </div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
              Tax Collected: ₹${b.totalTaxCollected} • Service Charge: ₹${b.totalServiceCharge}
            </div>
          </div>
        </li>
      `).join('');
    }
  } catch (err) {
    console.warn('Analytics loading restricted to manager/admin:', err);
  }
}
