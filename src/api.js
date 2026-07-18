import { db, isFirebaseConfigured } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

const API_BASE = '/api';

function apiFetch(url, options = {}) {
  const headers = { ...options.headers };
  const tenantId = localStorage.getItem('tenantId');
  if (tenantId) {
    headers['x-tenant-id'] = tenantId;
  }
  return fetch(url, { ...options, headers });
}


// Helper to load table data from Firestore directly (for real-time fallback/speed)
async function getTableData(tableName, fallbackUrl) {
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'tenants', localStorage.getItem('tenantId') || 'default', 'tables', tableName);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data().data || [];
      }
      return [];
    } catch (err) {
      console.warn(`Firestore read failed for "${tableName}", falling back to REST API:`, err);
    }
  }
  const res = await apiFetch(fallbackUrl);
  return res.json();
}

export const api = {
  // Auth
  async login(tenantId, username, password) {
    localStorage.setItem('tenantId', tenantId);
    const res = await apiFetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, username, password })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Login failed');
    }
    return res.json();
  },



  // System / Super Admin
  async getTenants() {
    const res = await apiFetch(`${API_BASE}/system/tenants`);
    return res.json();
  },
  async createTenant(tenantData) {
    const res = await apiFetch(`${API_BASE}/system/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tenantData)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create tenant');
    }
    return res.json();
  },
  async updateTenantStatus(id, active) {
    const res = await apiFetch(`${API_BASE}/system/tenants/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active })
    });
    return res.json();
  },
  async deleteTenant(id) {
    const res = await apiFetch(`${API_BASE}/system/tenants/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete tenant');
    }
    return res.json();
  },

  async getUsers() {
    return getTableData('users', `${API_BASE}/users`);
  },

  // Routes
  async getRoutes() {
    return getTableData('routes', `${API_BASE}/routes`);
  },
  async createRoute(routeData) {
    const res = await apiFetch(`${API_BASE}/routes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(routeData)
    });
    return res.json();
  },
  async updateRoute(id, routeData) {
    const res = await apiFetch(`${API_BASE}/routes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(routeData)
    });
    return res.json();
  },
  async deleteRoute(id) {
    const res = await apiFetch(`${API_BASE}/routes/${id}`, {
      method: 'DELETE'
    });
    return res.json();
  },

  // Shops
  async getShops() {
    return getTableData('shops', `${API_BASE}/shops`);
  },
  async createShop(shopData) {
    const res = await apiFetch(`${API_BASE}/shops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shopData)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create shop');
    }
    return res.json();
  },
  async updateShop(id, shopData) {
    const res = await apiFetch(`${API_BASE}/shops/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shopData)
    });
    return res.json();
  },

  // Products
  async getProducts() {
    return getTableData('products', `${API_BASE}/products`);
  },
  async createProduct(productData) {
    const res = await apiFetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData)
    });
    return res.json();
  },
  async updateProduct(id, productData) {
    const res = await apiFetch(`${API_BASE}/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData)
    });
    return res.json();
  },

  // Purchases
  async getPurchases() {
    return getTableData('purchases', `${API_BASE}/purchases`);
  },
  async createPurchase(purchaseData) {
    const res = await apiFetch(`${API_BASE}/purchases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(purchaseData)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to record purchase');
    }
    return res.json();
  },

  // Stock Ledger
  async getStockLedger() {
    return getTableData('stock_ledger', `${API_BASE}/stock/ledger`);
  },

  // Orders
  async getOrders() {
    return getTableData('orders', `${API_BASE}/orders`);
  },
  async getOrderItems() {
    return getTableData('order_items', `${API_BASE}/orders/items`);
  },
  async createOrder(orderData) {
    const res = await apiFetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to place order');
    }
    return res.json();
  },

  // Deliveries
  async getDeliveries() {
    return getTableData('deliveries', `${API_BASE}/deliveries`);
  },
  async completeDelivery(id, remarks) {
    const res = await apiFetch(`${API_BASE}/deliveries/${id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remarks })
    });
    return res.json();
  },

  // Payments & Collections
  async getPayments() {
    return getTableData('payments', `${API_BASE}/payments`);
  },
  async createPayment(paymentData) {
    const res = await apiFetch(`${API_BASE}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paymentData)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to register payment');
    }
    return res.json();
  },
  async getOutstandingHistory() {
    return getTableData('outstanding_history', `${API_BASE}/outstanding/history`);
  },

  // Notifications
  async getNotifications() {
    return getTableData('notifications', `${API_BASE}/notifications`);
  },
  async markNotificationsRead() {
    const res = await apiFetch(`${API_BASE}/notifications/mark-read`, {
      method: 'POST'
    });
    return res.json();
  },

  // Reports
  async getReportSummary() {
    const res = await apiFetch(`${API_BASE}/reports/summary`);
    return res.json();
  },

  // Corrections & Cancellations
  async deleteShop(id) {
    const res = await apiFetch(`${API_BASE}/shops/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete shop');
    }
    return res.json();
  },
  async deleteProduct(id) {
    const res = await apiFetch(`${API_BASE}/products/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete product');
    }
    return res.json();
  },
  async deletePurchase(id) {
    const res = await apiFetch(`${API_BASE}/purchases/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete purchase');
    }
    return res.json();
  },
  async deleteOrder(id) {
    const res = await apiFetch(`${API_BASE}/orders/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to cancel/delete order');
    }
    return res.json();
  },

  // User Access Management
  async createUser(userData) {
    const res = await apiFetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create user access');
    }
    return res.json();
  },
  async updateUser(id, userData) {
    const res = await apiFetch(`${API_BASE}/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update user access');
    }
    return res.json();
  },
  async deleteUser(id) {
    const res = await apiFetch(`${API_BASE}/users/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete user access');
    }
    return res.json();
  },

  // Recycle Bin
  async getRecycleBin() {
    return getTableData('recycle_bin', `${API_BASE}/recycle-bin`);
  },
  async restoreRecycleBinItem(id) {
    const res = await apiFetch(`${API_BASE}/recycle-bin/${id}/restore`, {
      method: 'POST'
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to restore item');
    }
    return res.json();
  },
  async purgeRecycleBinItem(id) {
    const res = await apiFetch(`${API_BASE}/recycle-bin/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to purge item');
    }
    return res.json();
  },

  // Vehicle Direct Sales
  async getVehicles() {
    return getTableData('vehicles', `${API_BASE}/vehicles`);
  },
  async createVehicle(vehicleData) {
    const res = await apiFetch(`${API_BASE}/vehicles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vehicleData)
    });
    return res.json();
  },
  async updateVehicle(id, vehicleData) {
    const res = await apiFetch(`${API_BASE}/vehicles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vehicleData)
    });
    return res.json();
  },
  async deleteVehicle(id) {
    const res = await apiFetch(`${API_BASE}/vehicles/${id}`, {
      method: 'DELETE'
    });
    return res.json();
  },
  async getVehicleStock() {
    return getTableData('vehicle_stock', `${API_BASE}/vehicles/stock`);
  },
  async getVehicleDispatches() {
    return getTableData('vehicle_dispatches', `${API_BASE}/vehicles/dispatches`);
  },
  async dispatchVehicleStock(dispatchData) {
    const res = await apiFetch(`${API_BASE}/vehicles/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dispatchData)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to dispatch vehicle stock');
    }
    return res.json();
  },
  async getVehicleSales() {
    return getTableData('vehicle_sales', `${API_BASE}/vehicles/sales`);
  },
  async createVehicleSale(saleData) {
    const res = await apiFetch(`${API_BASE}/vehicles/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(saleData)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to record direct sale');
    }
    return res.json();
  },
  async getVehicleReconciliations() {
    return getTableData('vehicle_reconciliations', `${API_BASE}/vehicles/reconciliations`);
  },
  async reconcileVehicleStock(reconcileData) {
    const res = await apiFetch(`${API_BASE}/vehicles/reconcile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reconcileData)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to reconcile vehicle stock');
    }
    return res.json();
  }
};

export default api;
