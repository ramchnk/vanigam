const API_BASE = '/api';

export const api = {
  // Auth
  async login(username, password) {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Login failed');
    }
    return res.json();
  },

  async getUsers() {
    const res = await fetch(`${API_BASE}/users`);
    return res.json();
  },

  // Routes
  async getRoutes() {
    const res = await fetch(`${API_BASE}/routes`);
    return res.json();
  },
  async createRoute(routeData) {
    const res = await fetch(`${API_BASE}/routes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(routeData)
    });
    return res.json();
  },
  async updateRoute(id, routeData) {
    const res = await fetch(`${API_BASE}/routes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(routeData)
    });
    return res.json();
  },
  async deleteRoute(id) {
    const res = await fetch(`${API_BASE}/routes/${id}`, {
      method: 'DELETE'
    });
    return res.json();
  },

  // Shops
  async getShops() {
    const res = await fetch(`${API_BASE}/shops`);
    return res.json();
  },
  async createShop(shopData) {
    const res = await fetch(`${API_BASE}/shops`, {
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
    const res = await fetch(`${API_BASE}/shops/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shopData)
    });
    return res.json();
  },

  // Products
  async getProducts() {
    const res = await fetch(`${API_BASE}/products`);
    return res.json();
  },
  async createProduct(productData) {
    const res = await fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData)
    });
    return res.json();
  },
  async updateProduct(id, productData) {
    const res = await fetch(`${API_BASE}/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData)
    });
    return res.json();
  },

  // Purchases
  async getPurchases() {
    const res = await fetch(`${API_BASE}/purchases`);
    return res.json();
  },
  async createPurchase(purchaseData) {
    const res = await fetch(`${API_BASE}/purchases`, {
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
    const res = await fetch(`${API_BASE}/stock/ledger`);
    return res.json();
  },

  // Orders
  async getOrders() {
    const res = await fetch(`${API_BASE}/orders`);
    return res.json();
  },
  async getOrderItems() {
    const res = await fetch(`${API_BASE}/orders/items`);
    return res.json();
  },
  async createOrder(orderData) {
    const res = await fetch(`${API_BASE}/orders`, {
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
    const res = await fetch(`${API_BASE}/deliveries`);
    return res.json();
  },
  async completeDelivery(id, remarks) {
    const res = await fetch(`${API_BASE}/deliveries/${id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remarks })
    });
    return res.json();
  },

  // Payments & Collections
  async getPayments() {
    const res = await fetch(`${API_BASE}/payments`);
    return res.json();
  },
  async createPayment(paymentData) {
    const res = await fetch(`${API_BASE}/payments`, {
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
    const res = await fetch(`${API_BASE}/outstanding/history`);
    return res.json();
  },

  // Notifications
  async getNotifications() {
    const res = await fetch(`${API_BASE}/notifications`);
    return res.json();
  },
  async markNotificationsRead() {
    const res = await fetch(`${API_BASE}/notifications/mark-read`, {
      method: 'POST'
    });
    return res.json();
  },

  // Reports
  async getReportSummary() {
    const res = await fetch(`${API_BASE}/reports/summary`);
    return res.json();
  },

  // Corrections & Cancellations
  async deleteShop(id) {
    const res = await fetch(`${API_BASE}/shops/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete shop');
    }
    return res.json();
  },
  async deleteProduct(id) {
    const res = await fetch(`${API_BASE}/products/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete product');
    }
    return res.json();
  },
  async deletePurchase(id) {
    const res = await fetch(`${API_BASE}/purchases/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete purchase');
    }
    return res.json();
  },
  async deleteOrder(id) {
    const res = await fetch(`${API_BASE}/orders/${id}`, {
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
    const res = await fetch(`${API_BASE}/users`, {
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
    const res = await fetch(`${API_BASE}/users/${id}`, {
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
    const res = await fetch(`${API_BASE}/users/${id}`, {
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
    const res = await fetch(`${API_BASE}/recycle-bin`);
    return res.json();
  },
  async restoreRecycleBinItem(id) {
    const res = await fetch(`${API_BASE}/recycle-bin/${id}/restore`, {
      method: 'POST'
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to restore item');
    }
    return res.json();
  },
  async purgeRecycleBinItem(id) {
    const res = await fetch(`${API_BASE}/recycle-bin/${id}`, {
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
    const res = await fetch(`${API_BASE}/vehicles`);
    return res.json();
  },
  async createVehicle(vehicleData) {
    const res = await fetch(`${API_BASE}/vehicles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vehicleData)
    });
    return res.json();
  },
  async updateVehicle(id, vehicleData) {
    const res = await fetch(`${API_BASE}/vehicles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vehicleData)
    });
    return res.json();
  },
  async deleteVehicle(id) {
    const res = await fetch(`${API_BASE}/vehicles/${id}`, {
      method: 'DELETE'
    });
    return res.json();
  },
  async getVehicleStock() {
    const res = await fetch(`${API_BASE}/vehicles/stock`);
    return res.json();
  },
  async getVehicleDispatches() {
    const res = await fetch(`${API_BASE}/vehicles/dispatches`);
    return res.json();
  },
  async dispatchVehicleStock(dispatchData) {
    const res = await fetch(`${API_BASE}/vehicles/dispatch`, {
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
    const res = await fetch(`${API_BASE}/vehicles/sales`);
    return res.json();
  },
  async createVehicleSale(saleData) {
    const res = await fetch(`${API_BASE}/vehicles/sales`, {
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
    const res = await fetch(`${API_BASE}/vehicles/reconciliations`);
    return res.json();
  },
  async reconcileVehicleStock(reconcileData) {
    const res = await fetch(`${API_BASE}/vehicles/reconcile`, {
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
