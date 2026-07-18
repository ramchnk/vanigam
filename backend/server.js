import express from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db as firestoreDb, isMock as isFirebaseMock, initError as firebaseInitError, credentialSource as firebaseCredSource, debugInfo as firebaseDebugInfo } from './firebaseAdmin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const getDbPath = (tenantId) => path.join(__dirname, `db_${tenantId}.json`);

const app = express();
app.use(cors());
app.use(express.json());

// Simple lock mechanism for transactional integrity
let dbLock = false;
async function acquireLock() {
  while (dbLock) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  dbLock = true;
}
function releaseLock() {
  dbLock = false;
}

// Database Helpers
let cachedDBs = {};      // { [tenantId]: dbData }
let cachedTimestamps = {}; // { [tenantId]: timestamp }

async function readDB(tenantId) {
  if (isFirebaseMock) {
    try {
      const data = await fs.readFile(getDbPath(tenantId), 'utf8');
      const db = JSON.parse(data);
      if (!db.vehicles) db.vehicles = [];
      if (!db.vehicle_stock) db.vehicle_stock = [];
      if (!db.vehicle_dispatches) db.vehicle_dispatches = [];
      if (!db.vehicle_sales) db.vehicle_sales = [];
      if (!db.vehicle_reconciliations) db.vehicle_reconciliations = [];
      return db;
    } catch (error) {
      return await seedDB(tenantId);
    }
  }

  try {
    const metaRef = firestoreDb.collection('tenants').doc(tenantId).collection('tables').doc('_metadata');
    const metaSnap = await metaRef.get();
    
    let lastUpdated = 0;
    if (metaSnap.exists) {
      lastUpdated = metaSnap.data().last_updated || 0;
    }

    if (cachedDBs[tenantId] && cachedTimestamps[tenantId] >= lastUpdated) {
      return cachedDBs[tenantId];
    }

    // Cache missing or stale: load all docs from tenant-specific 'tables' collection
    const snapshot = await firestoreDb.collection('tenants').doc(tenantId).collection('tables').get();
    const dbData = {};
    snapshot.forEach(doc => {
      if (doc.id !== '_metadata') {
        dbData[doc.id] = doc.data().data || [];
      }
    });

    const tableKeys = [
      'users', 'routes', 'shops', 'products', 'purchases', 'stock_ledger',
      'orders', 'order_items', 'deliveries', 'payments', 'outstanding_history',
      'bills', 'notifications', 'vehicles', 'vehicle_stock',
      'vehicle_dispatches', 'vehicle_sales', 'vehicle_reconciliations', 'recycle_bin'
    ];
    for (const key of tableKeys) {
      if (!dbData[key]) dbData[key] = [];
    }

    cachedDBs[tenantId] = dbData;
    cachedTimestamps[tenantId] = lastUpdated || Date.now();
    return cachedDBs[tenantId];
  } catch (err) {
    console.error('Error reading from Firestore:', err);
    return await seedDB(tenantId);
  }
}

async function writeDB(tenantId, data) {
  if (isFirebaseMock) {
    await fs.writeFile(getDbPath(tenantId), JSON.stringify(data, null, 2), 'utf8');
    return;
  }

  try {
    const tableKeys = [
      'users', 'routes', 'shops', 'products', 'purchases', 'stock_ledger',
      'orders', 'order_items', 'deliveries', 'payments', 'outstanding_history',
      'bills', 'notifications', 'vehicles', 'vehicle_stock',
      'vehicle_dispatches', 'vehicle_sales', 'vehicle_reconciliations', 'recycle_bin'
    ];

    const batch = firestoreDb.batch();
    let hasChanges = false;

    for (const key of tableKeys) {
      const oldDataStr = cachedDBs[tenantId] ? JSON.stringify(cachedDBs[tenantId][key] || []) : '';
      const newDataStr = JSON.stringify(data[key] || []);

      if (oldDataStr !== newDataStr) {
        const docRef = firestoreDb.collection('tenants').doc(tenantId).collection('tables').doc(key);
        batch.set(docRef, { data: data[key] || [] });
        hasChanges = true;
      }
    }

    if (hasChanges) {
      const timestamp = Date.now();
      const metaRef = firestoreDb.collection('tenants').doc(tenantId).collection('tables').doc('_metadata');
      batch.set(metaRef, { last_updated: timestamp }, { merge: true });
      
      await batch.commit();
      
      // Update cache
      cachedDBs[tenantId] = JSON.parse(JSON.stringify(data));
      cachedTimestamps[tenantId] = timestamp;
    }
  } catch (err) {
    console.error('Error writing to Firestore:', err);
  }
}

// System DB Helpers
const systemDbPath = path.join(__dirname, 'db_system.json');

async function readSystemDB() {
  if (isFirebaseMock) {
    try {
      const data = await fs.readFile(systemDbPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return { tenants: [] };
    }
  }

  try {
    const docSnap = await firestoreDb.collection('system').doc('config').get();
    if (docSnap.exists) {
      return docSnap.data();
    }
    return { tenants: [] };
  } catch (err) {
    console.error('Error reading system DB:', err);
    return { tenants: [] };
  }
}

async function writeSystemDB(data) {
  if (isFirebaseMock) {
    await fs.writeFile(systemDbPath, JSON.stringify(data, null, 2), 'utf8');
    return;
  }
  try {
    await firestoreDb.collection('system').doc('config').set(data);
  } catch (err) {
    console.error('Error writing system DB:', err);
  }
}

// Initial Data Seeding
async function seedDB(tenantId) {
  const users = [
    { id: 'u1', username: 'admin', password: '123', role: 'admin', name: 'Admin Murugan', mobile: '9876543210', active: true },
    { id: 'u2', username: 'sales', password: '123', role: 'salesman', name: 'Salesman Karthik', mobile: '9876543211', active: true },
    { id: 'u3', username: 'delivery', password: '123', role: 'delivery', name: 'Delivery Man Ramesh', mobile: '9876543212', active: true }
  ];

  const routes = [
    { id: 'r1', name_en: 'Trichy Road Route', name_ta: 'திருச்சி சாலை வழித்தடம்', salesman_id: 'u2', delivery_man_id: 'u3' },
    { id: 'r2', name_en: 'Madurai Bypass Route', name_ta: 'மதுரை பைபாஸ் வழித்தடம்', salesman_id: 'u2', delivery_man_id: 'u3' },
    { id: 'r3', name_en: 'Kovai Bypass Route', name_ta: 'கோவை பைபாஸ் வழித்தடம்', salesman_id: 'u2', delivery_man_id: 'u3' },
    { id: 'r4', name_en: 'Salem Highway Route', name_ta: 'சேலம் நெடுஞ்சாலை வழித்தடம்', salesman_id: 'u2', delivery_man_id: 'u3' },
    { id: 'r5', name_en: 'Tanjore Palace Route', name_ta: 'தஞ்சாவூர் அரண்மனை வழித்தடம்', salesman_id: 'u2', delivery_man_id: 'u3' }
  ];

  // Helper lists to generate 250 shops programmatically
  const shopNounsEn = ['Raja', 'Annam', 'Saravana', 'Kumaran', 'Mani', 'Vasantha', 'Selvam', 'Victory', 'Murugan', 'Kavitha'];
  const shopNounsTa = ['ராஜா', 'அன்னம்', 'சரவணா', 'குமரன்', 'மணி', 'வசந்தா', 'செல்வம்', 'விக்டரி', 'முருகன்', 'கவிதா'];
  const shopTypesEn = ['Cool Drinks', 'Groceries', 'Supermarket', 'Sweets Shop', 'Tea Stall'];
  const shopTypesTa = ['குளிர் பானங்கள்', 'மளிகை கடை', 'சூப்பர் மார்க்கெட்', 'ஸ்வீட்ஸ் கடை', 'டீ ஸ்டால்'];
  
  const shops = [];
  let shopCounter = 1;

  for (let rIdx = 0; rIdx < routes.length; rIdx++) {
    const route = routes[rIdx];
    for (let sIdx = 1; sIdx <= 50; sIdx++) {
      const nounIdx = (rIdx * 50 + sIdx) % shopNounsEn.length;
      const typeIdx = (rIdx * 50 + sIdx) % shopTypesEn.length;
      
      const shopNameEn = `${shopNounsEn[nounIdx]} ${shopTypesEn[typeIdx]} #${sIdx}`;
      const shopNameTa = `${shopNounsTa[nounIdx]} ${shopTypesTa[typeIdx]} #${sIdx}`;
      const shopType = (sIdx % 3 === 0) ? 'wholesale' : 'retail';

      shops.push({
        id: `s_${rIdx + 1}_${sIdx}`,
        name_en: shopNameEn,
        name_ta: shopNameTa,
        contact_person: `Shop Owner ${shopCounter}`,
        mobile: `90000${String(shopCounter).padStart(5, '0')}`,
        gst_number: `33AAAAA${String(shopCounter).padStart(5, '0')}A1Z${shopCounter % 9}`,
        address: `${sIdx}, Bazaar Street, Route ${rIdx + 1}`,
        shop_type: shopType,
        route_id: route.id,
        status: 'active',
        outstanding_amount: 0
      });
      shopCounter++;
    }
  }

  const products = [
    { id: 'p1', name_en: 'Coca Cola 2.25 Litre', name_ta: 'கோகோ கோலா 2.25 லிட்டர்', brand: 'Coca Cola', category: 'Soft Drinks', size: '2.25L', case_qty_rule: 9, purchase_price: 80, wholesale_price: 90, retail_price: 100, current_stock_bottles: 90, min_stock: 18, status: 'active' }, // 10 cases
    { id: 'p2', name_en: 'Coca Cola 500 ml', name_ta: 'கோகோ கோலா 500 மி.லி', brand: 'Coca Cola', category: 'Soft Drinks', size: '500ml', case_qty_rule: 24, purchase_price: 30, wholesale_price: 35, retail_price: 40, current_stock_bottles: 240, min_stock: 48, status: 'active' }, // 10 cases
    { id: 'p3', name_en: 'Coca Cola 250 ml', name_ta: 'கோகோ கோலா 250 மி.லி', brand: 'Coca Cola', category: 'Soft Drinks', size: '250ml', case_qty_rule: 24, purchase_price: 15, wholesale_price: 18, retail_price: 20, current_stock_bottles: 0, min_stock: 48, status: 'active' }, // Out of stock
    { id: 'p4', name_en: 'Sprite 2.25 Litre', name_ta: 'ஸ்ப்ரைட் 2.25 லிட்டர்', brand: 'Sprite', category: 'Soft Drinks', size: '2.25L', case_qty_rule: 9, purchase_price: 80, wholesale_price: 90, retail_price: 100, current_stock_bottles: 45, min_stock: 18, status: 'active' }, // 5 cases
    { id: 'p5', name_en: 'Sprite 500 ml', name_ta: 'ஸ்ப்ரைட் 500 மி.லி', brand: 'Sprite', category: 'Soft Drinks', size: '500ml', case_qty_rule: 24, purchase_price: 30, wholesale_price: 35, retail_price: 40, current_stock_bottles: 120, min_stock: 48, status: 'active' }, // 5 cases
    { id: 'p6', name_en: 'Maaza 1 Litre', name_ta: 'மாஸா 1 லிட்டர்', brand: 'Maaza', category: 'Juices', size: '1L', case_qty_rule: 12, purchase_price: 45, wholesale_price: 52, retail_price: 60, current_stock_bottles: 12, min_stock: 12, status: 'active' } // Low stock (1 case)
  ];

  const purchases = [];
  const stock_ledger = products.map((p, idx) => ({
    id: `sl_${idx + 1}`,
    product_id: p.id,
    transaction_type: 'opening',
    cases_change: Math.floor(p.current_stock_bottles / p.case_qty_rule),
    bottles_change: p.current_stock_bottles % p.case_qty_rule,
    running_stock_bottles: p.current_stock_bottles,
    timestamp: new Date().toISOString()
  }));

  const orders = [];
  const order_items = [];
  const deliveries = [];
  const payments = [];
  const outstanding_history = [];
  const bills = [];
  const notifications = [
    { id: 'n1', type: 'out_of_stock', message_en: 'Coca Cola 250 ml is Out of Stock!', message_ta: 'கோகோ கோலா 250 மி.லி கையிருப்பு இல்லை!', status: 'unread', created_at: new Date().toISOString() },
    { id: 'n2', type: 'low_stock', message_en: 'Maaza 1 Litre stock is Low!', message_ta: 'மாஸா 1 லிட்டர் கையிருப்பு குறைவாக உள்ளது!', status: 'unread', created_at: new Date().toISOString() }
  ];

  const db = {
    users,
    routes,
    shops,
    products,
    purchases,
    stock_ledger,
    orders,
    order_items,
    deliveries,
    payments,
    outstanding_history,
    bills,
    notifications,
    vehicles: [],
    vehicle_stock: [],
    vehicle_dispatches: [],
    vehicle_sales: [],
    vehicle_reconciliations: [],
    recycle_bin: []
  };

  await writeDB(tenantId, db);
  return db;
}

// Add req.tenantId middleware
app.use((req, res, next) => {
  if (req.path === '/api/login' || req.path === '/api/debug' || req.path.startsWith('/api/system')) {
    return next();
  }
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) {
    return res.status(400).json({ error: 'Missing x-tenant-id header' });
  }
  req.tenantId = tenantId;
  next();
});

// ---------------- REST API ENDPOINTS ----------------

// Debug endpoint for Vercel/Firebase credentials check
app.get('/api/debug', (req, res) => {
  res.json({
    isFirebaseMock,
    firebaseInitError,
    firebaseCredSource,
    firebaseDebugInfo,
    envDetected: {
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'missing',
      FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || 'missing',
      hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
      privateKeyLength: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.length : 0,
      privateKeyFirstChars: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.substring(0, 30) : '',
      privateKeyLastChars: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.substring(process.env.FIREBASE_PRIVATE_KEY.length - 30) : '',
    }
  });
});

// Auth
app.post('/api/login', async (req, res) => {
  const { tenantId, username, password } = req.body;
  if (!tenantId) return res.status(400).json({ error: 'Company Code (Tenant ID) is required' });
  
  if (tenantId === 'SYSTEM') {
    if (username === 'superadmin' && password === 'superadmin123') {
      return res.json({ id: 'sys_1', username: 'superadmin', role: 'superadmin', name: 'Super Admin', mobile: '', tenantId: 'SYSTEM' });
    }
    return res.status(401).json({ error: 'Invalid super admin credentials' });
  }

  const systemDB = await readSystemDB();
  const tenant = systemDB.tenants.find(t => t.id === tenantId);
  if (!tenant) {
    return res.status(404).json({ error: 'Company Code not found. Please contact Super Admin.' });
  }
  if (!tenant.active) {
    return res.status(403).json({ error: 'Company account is deactivated' });
  }

  const db = await readDB(tenantId);
  const user = db.users.find(u => u.username === username && u.password === password && u.active);
  if (user) {
    res.json({ id: user.id, username: user.username, role: user.role, name: user.name, mobile: user.mobile, tenantId });
  } else {
    res.status(401).json({ error: 'Invalid credentials or inactive user' });
  }
});

// System / Tenants
app.get('/api/system/tenants', async (req, res) => {
  if (req.headers['x-tenant-id'] !== 'SYSTEM') return res.status(403).json({ error: 'Unauthorized' });
  const systemDB = await readSystemDB();
  res.json(systemDB.tenants || []);
});

app.post('/api/system/tenants', async (req, res) => {
  if (req.headers['x-tenant-id'] !== 'SYSTEM') return res.status(403).json({ error: 'Unauthorized' });
  await acquireLock();
  try {
    const systemDB = await readSystemDB();
    const { id, name, adminUsername, adminPassword } = req.body;
    
    if (!id || !name) {
      return res.status(400).json({ error: 'Tenant ID and Name are required' });
    }
    
    if (systemDB.tenants && systemDB.tenants.some(t => t.id === id.toUpperCase())) {
      return res.status(400).json({ error: 'Tenant ID already exists' });
    }

    const newTenant = {
      id: id.toUpperCase(),
      name,
      active: true,
      created_at: new Date().toISOString()
    };

    if (!systemDB.tenants) systemDB.tenants = [];
    systemDB.tenants.push(newTenant);
    await writeSystemDB(systemDB);
    
    // Seed the database for this new tenant
    await seedDB(newTenant.id, adminUsername, adminPassword);

    res.status(201).json(newTenant);
  } finally {
    releaseLock();
  }
});

app.put('/api/system/tenants/:id/status', async (req, res) => {
  if (req.headers['x-tenant-id'] !== 'SYSTEM') return res.status(403).json({ error: 'Unauthorized' });
  await acquireLock();
  try {
    const systemDB = await readSystemDB();
    if (!systemDB.tenants) systemDB.tenants = [];
    const tenant = systemDB.tenants.find(t => t.id === req.params.id);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    
    tenant.active = req.body.active;
    await writeSystemDB(systemDB);
    res.json(tenant);
  } finally {
    releaseLock();
  }
});

app.delete('/api/system/tenants/:id', async (req, res) => {
  if (req.headers['x-tenant-id'] !== 'SYSTEM') return res.status(403).json({ error: 'Unauthorized' });
  await acquireLock();
  try {
    const systemDB = await readSystemDB();
    if (!systemDB.tenants) systemDB.tenants = [];
    const tenantIndex = systemDB.tenants.findIndex(t => t.id === req.params.id);
    if (tenantIndex === -1) return res.status(404).json({ error: 'Tenant not found' });
    
    // Remove tenant from system DB
    systemDB.tenants.splice(tenantIndex, 1);
    await writeSystemDB(systemDB);

    // Optionally delete the physical db file if local
    if (isFirebaseMock) {
      const tenantDbPath = path.join(__dirname, `db_${req.params.id}.json`);
      const fsModule = require('fs');
      if (fsModule.existsSync(tenantDbPath)) {
        fsModule.unlinkSync(tenantDbPath);
      }
    }

    res.json({ success: true });
  } finally {
    releaseLock();
  }
});

// Users
app.get('/api/users', async (req, res) => {
  const db = await readDB(req.tenantId);
  res.json(db.users);
});

app.post('/api/users', async (req, res) => {
  await acquireLock();
  try {
    const db = await readDB(req.tenantId);
    const { username, password, role, name, mobile, active } = req.body;
    
    // Check duplicate username
    if (db.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const newUser = {
      id: `u_${Date.now()}`,
      username: username.toLowerCase(),
      password, // seed uses plain password, keeping it simple for mock DB
      role,
      name,
      mobile: mobile || '',
      active: active !== undefined ? active : true
    };

    db.users.push(newUser);
    await writeDB(req.tenantId, db);
    res.status(201).json(newUser);
  } finally {
    releaseLock();
  }
});

app.put('/api/users/:id', async (req, res) => {
  await acquireLock();
  try {
    const db = await readDB(req.tenantId);
    const index = db.users.findIndex(u => u.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check duplicate username
    if (req.body.username && db.users.some(u => u.username.toLowerCase() === req.body.username.toLowerCase() && u.id !== req.params.id)) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    db.users[index] = { ...db.users[index], ...req.body };
    await writeDB(req.tenantId, db);
    res.json(db.users[index]);
  } finally {
    releaseLock();
  }
});

app.delete('/api/users/:id', async (req, res) => {
  await acquireLock();
  try {
    const db = await readDB(req.tenantId);
    const userId = req.params.id;

    // Constrain deletion if user is assigned to route or has bookings
    const hasRoute = db.routes.some(r => r.salesman_id === userId || r.delivery_man_id === userId);
    const hasOrders = db.orders.some(o => o.salesman_id === userId || o.delivery_man_id === userId);

    if (hasRoute || hasOrders) {
      return res.status(400).json({
        error: 'Cannot delete user with route assignments or booking records. Please deactivate them instead.'
      });
    }

    db.users = db.users.filter(u => u.id !== userId);
    await writeDB(req.tenantId, db);
    res.json({ success: true });
  } finally {
    releaseLock();
  }
});

// Routes CRUD
app.get('/api/routes', async (req, res) => {
  const db = await readDB(req.tenantId);
  res.json(db.routes);
});

app.post('/api/routes', async (req, res) => {
  await acquireLock();
  try {
    const db = await readDB(req.tenantId);
    const newRoute = {
      id: `r_${Date.now()}`,
      name_en: req.body.name_en,
      name_ta: req.body.name_ta,
      salesman_id: req.body.salesman_id || '',
      delivery_man_id: req.body.delivery_man_id || ''
    };
    db.routes.push(newRoute);
    await writeDB(req.tenantId, db);
    res.status(201).json(newRoute);
  } finally {
    releaseLock();
  }
});

app.put('/api/routes/:id', async (req, res) => {
  await acquireLock();
  try {
    const db = await readDB(req.tenantId);
    const index = db.routes.findIndex(r => r.id === req.params.id);
    if (index !== -1) {
      db.routes[index] = { ...db.routes[index], ...req.body };
      await writeDB(req.tenantId, db);
      res.json(db.routes[index]);
    } else {
      res.status(404).json({ error: 'Route not found' });
    }
  } finally {
    releaseLock();
  }
});

app.delete('/api/routes/:id', async (req, res) => {
  await acquireLock();
  try {
    const db = await readDB(req.tenantId);
    const routeId = req.params.id;
    const route = db.routes.find(r => r.id === routeId);
    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }

    // Soft delete route
    db.routes = db.routes.filter(r => r.id !== routeId);
    
    if (!db.recycle_bin) db.recycle_bin = [];
    db.recycle_bin.push({
      id: `rb_${Date.now()}_rt`,
      table: 'routes',
      original_id: routeId,
      data: route,
      deleted_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    });

    await writeDB(req.tenantId, db);
    res.json({ success: true });
  } finally {
    releaseLock();
  }
});

// Shops CRUD
app.get('/api/shops', async (req, res) => {
  const db = await readDB(req.tenantId);
  res.json(db.shops);
});

app.post('/api/shops', async (req, res) => {
  await acquireLock();
  try {
    const db = await readDB(req.tenantId);
    const newShop = {
      id: `s_${Date.now()}`,
      name_en: req.body.name_en || req.body.name,
      name_ta: req.body.name_ta || req.body.name,
      contact_person: req.body.contact_person,
      mobile: req.body.mobile,
      gst_number: req.body.gst_number || '',
      address: req.body.address,
      shop_type: req.body.shop_type || 'retail',
      route_id: req.body.route_id,
      status: req.body.status || 'active',
      outstanding_amount: Number(req.body.outstanding_amount || 0)
    };
    db.shops.push(newShop);
    if (newShop.outstanding_amount > 0) {
      db.outstanding_history.push({
        id: `oh_${Date.now()}`,
        shop_id: newShop.id,
        change_amount: newShop.outstanding_amount,
        balance_amount: newShop.outstanding_amount,
        description: 'Opening Outstanding',
        date: new Date().toISOString()
      });
    }
    await writeDB(req.tenantId, db);
    res.status(201).json(newShop);
  } finally {
    releaseLock();
  }
});

app.put('/api/shops/:id', async (req, res) => {
  await acquireLock();
  try {
    const db = await readDB(req.tenantId);
    const index = db.shops.findIndex(s => s.id === req.params.id);
    if (index !== -1) {
      const prevOutstanding = db.shops[index].outstanding_amount;
      const updatedShop = { ...db.shops[index], ...req.body };
      updatedShop.outstanding_amount = Number(updatedShop.outstanding_amount || 0);

      // Track outstanding adjustment if modified manually
      if (updatedShop.outstanding_amount !== prevOutstanding) {
        db.outstanding_history.push({
          id: `oh_${Date.now()}`,
          shop_id: updatedShop.id,
          change_amount: updatedShop.outstanding_amount - prevOutstanding,
          balance_amount: updatedShop.outstanding_amount,
          description: 'Manual adjustment by Admin',
          date: new Date().toISOString()
        });
      }

      db.shops[index] = updatedShop;
      await writeDB(req.tenantId, db);
      res.json(updatedShop);
    } else {
      res.status(404).json({ error: 'Shop not found' });
    }
  } finally {
    releaseLock();
  }
});

// Products CRUD
app.get('/api/products', async (req, res) => {
  const db = await readDB(req.tenantId);
  res.json(db.products);
});

app.post('/api/products', async (req, res) => {
  await acquireLock();
  try {
    const db = await readDB(req.tenantId);
    const newProduct = {
      id: `p_${Date.now()}`,
      name_en: req.body.name_en,
      name_ta: req.body.name_ta,
      brand: req.body.brand,
      category: req.body.category || '',
      size: req.body.size,
      case_qty_rule: Number(req.body.case_qty_rule),
      purchase_price: Number(req.body.purchase_price),
      wholesale_price: Number(req.body.wholesale_price),
      retail_price: Number(req.body.retail_price),
      current_stock_bottles: Number(req.body.current_stock_bottles || 0),
      min_stock: Number(req.body.min_stock),
      status: req.body.status || 'active'
    };
    db.products.push(newProduct);
    // Log initial ledger
    db.stock_ledger.push({
      id: `sl_${Date.now()}`,
      product_id: newProduct.id,
      transaction_type: 'opening',
      cases_change: Math.floor(newProduct.current_stock_bottles / newProduct.case_qty_rule),
      bottles_change: newProduct.current_stock_bottles % newProduct.case_qty_rule,
      running_stock_bottles: newProduct.current_stock_bottles,
      timestamp: new Date().toISOString()
    });
    await writeDB(req.tenantId, db);
    res.status(201).json(newProduct);
  } finally {
    releaseLock();
  }
});

app.put('/api/products/:id', async (req, res) => {
  await acquireLock();
  try {
    const db = await readDB(req.tenantId);
    const index = db.products.findIndex(p => p.id === req.params.id);
    if (index !== -1) {
      db.products[index] = { ...db.products[index], ...req.body };
      await writeDB(req.tenantId, db);
      res.json(db.products[index]);
    } else {
      res.status(404).json({ error: 'Product not found' });
    }
  } finally {
    releaseLock();
  }
});

// Purchases Entry
app.get('/api/purchases', async (req, res) => {
  const db = await readDB(req.tenantId);
  res.json(db.purchases);
});

app.post('/api/purchases', async (req, res) => {
  await acquireLock();
  try {
    const db = await readDB(req.tenantId);
    const { supplier, product_id, cases, bottles, purchase_price } = req.body;
    
    const productIndex = db.products.findIndex(p => p.id === product_id);
    if (productIndex === -1) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const product = db.products[productIndex];
    
    const addedBottles = (Number(cases || 0) * product.case_qty_rule) + Number(bottles || 0);
    const wasOutOfStock = product.current_stock_bottles === 0;

    // Update Stock
    product.current_stock_bottles += addedBottles;

    // Save purchase log
    const newPurchase = {
      id: `purch_${Date.now()}`,
      supplier,
      purchase_date: req.body.purchase_date || new Date().toISOString(),
      product_id,
      cases: Number(cases || 0),
      bottles: Number(bottles || 0),
      purchase_price: Number(purchase_price || product.purchase_price)
    };
    db.purchases.push(newPurchase);

    // Ledger log
    db.stock_ledger.push({
      id: `sl_${Date.now()}`,
      product_id,
      transaction_type: 'purchase',
      cases_change: Number(cases || 0),
      bottles_change: Number(bottles || 0),
      running_stock_bottles: product.current_stock_bottles,
      timestamp: new Date().toISOString()
    });

    // Notify Refill if it was out of stock
    if (wasOutOfStock && addedBottles > 0) {
      db.notifications.push({
        id: `n_${Date.now()}`,
        type: 'stock_refilled',
        message_en: `${product.name_en} (${product.size}) stock has been refilled.`,
        message_ta: `${product.name_ta} (${product.size}) கையிருப்பு நிரப்பப்பட்டுள்ளது.`,
        status: 'unread',
        created_at: new Date().toISOString()
      });
    }

    await writeDB(req.tenantId, db);
    res.status(201).json(newPurchase);
  } finally {
    releaseLock();
  }
});

// Stock Ledger
app.get('/api/stock/ledger', async (req, res) => {
  const db = await readDB(req.tenantId);
  res.json(db.stock_ledger);
});

// Create Order (Simulates Database Transaction / Overbooking Prevention)
app.post('/api/orders', async (req, res) => {
  await acquireLock();
  try {
    const db = await readDB(req.tenantId);
    const { shop_id, route_id, salesman_id, items, discount } = req.body;
    
    const shop = db.shops.find(s => s.id === shop_id);
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    // 1. Validate stock availability for all products inside a lock transaction
    const orderItemsToCreate = [];
    const stockUpdates = [];

    for (const item of items) {
      const product = db.products.find(p => p.id === item.product_id);
      if (!product) {
        return res.status(400).json({ error: `Product not found: ${item.product_id}` });
      }

      const totalQtyRequested = (Number(item.cases || 0) * product.case_qty_rule) + Number(item.bottles || 0);
      
      // Stock check
      if (product.current_stock_bottles < totalQtyRequested) {
        return res.status(400).json({
          error: `Insufficient stock for ${product.name_en}. Available: ${product.current_stock_bottles} bottles. Requested: ${totalQtyRequested} bottles. Order cancelled to prevent overbooking.`
        });
      }

      // Collect transaction modifications
      stockUpdates.push({
        product,
        qtyToSubtract: totalQtyRequested,
        casesChanged: Number(item.cases || 0),
        bottlesChanged: Number(item.bottles || 0)
      });

      // Price mapping
      const rate = shop.shop_type === 'wholesale' ? product.wholesale_price : product.retail_price;
      const amount = totalQtyRequested * (rate / product.case_qty_rule); // rate is based on cases/bottles proportionately

      orderItemsToCreate.push({
        id: `oi_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        product_id: product.id,
        cases: Number(item.cases || 0),
        bottles: Number(item.bottles || 0),
        rate: rate,
        amount: Math.round(amount)
      });
    }

    // 2. Commit stock deductions (we only reach here if all stock was verified!)
    for (const update of stockUpdates) {
      const { product, qtyToSubtract, casesChanged, bottlesChanged } = update;
      product.current_stock_bottles -= qtyToSubtract;

      // Add to Ledger
      db.stock_ledger.push({
        id: `sl_${Date.now()}_${product.id}`,
        product_id: product.id,
        transaction_type: 'sale',
        cases_change: -casesChanged,
        bottles_change: -bottlesChanged,
        running_stock_bottles: product.current_stock_bottles,
        timestamp: new Date().toISOString()
      });

      // Stock Alerts
      if (product.current_stock_bottles === 0) {
        db.notifications.push({
          id: `n_${Date.now()}_out`,
          type: 'out_of_stock',
          message_en: `${product.name_en} is Out of Stock!`,
          message_ta: `${product.name_ta} கையிருப்பு முற்றிலும் தீர்ந்துவிட்டது!`,
          status: 'unread',
          created_at: new Date().toISOString()
        });
      } else if (product.current_stock_bottles <= product.min_stock) {
        db.notifications.push({
          id: `n_${Date.now()}_low`,
          type: 'low_stock',
          message_en: `${product.name_en} stock is low (${product.current_stock_bottles} bottles remaining).`,
          message_ta: `${product.name_ta} கையிருப்பு குறைவாக உள்ளது (${product.current_stock_bottles} பாட்டில்கள் மட்டுமே உள்ளன).`,
          status: 'unread',
          created_at: new Date().toISOString()
        });
      }
    }

    // Calculate totals
    const totalAmount = orderItemsToCreate.reduce((sum, item) => sum + item.amount, 0);
    const discountAmt = Number(discount || 0);
    const netAmount = Math.max(0, totalAmount - discountAmt);

    // Get order counter
    const invoiceNum = `INV-${String(db.orders.length + 1001)}`;

    const newOrder = {
      id: `ord_${Date.now()}`,
      invoice_number: invoiceNum,
      route_id,
      shop_id,
      salesman_id,
      order_date: new Date().toISOString(),
      total_amount: totalAmount,
      discount: discountAmt,
      net_amount: netAmount,
      status: 'pending',
      delivery_man_id: db.routes.find(r => r.id === route_id)?.delivery_man_id || ''
    };

    // Store Order and Items
    db.orders.push(newOrder);
    
    orderItemsToCreate.forEach(oi => {
      oi.order_id = newOrder.id;
      db.order_items.push(oi);
    });

    // Create delivery entry
    db.deliveries.push({
      id: `del_${Date.now()}`,
      order_id: newOrder.id,
      delivery_man_id: newOrder.delivery_man_id,
      status: 'pending',
      delivery_time: null,
      remarks: ''
    });

    // Outstanding Alert for Delivery Man (updates only when items are delivered, or starts tracking outstanding now)
    // The business logic: Outstanding is generated. We update the shop's outstanding after delivery completion or when placing?
    // Let's increase the outstanding on order placement, and then collect it.
    shop.outstanding_amount += netAmount;
    db.outstanding_history.push({
      id: `oh_${Date.now()}`,
      shop_id: shop_id,
      change_amount: netAmount,
      balance_amount: shop.outstanding_amount,
      description: `Order ${invoiceNum} placed`,
      date: new Date().toISOString()
    });

    // Create notifications for deliveries
    db.notifications.push({
      id: `n_del_${Date.now()}`,
      type: 'pending_delivery',
      message_en: `New pending delivery for ${shop.name_en}. Invoice: ${invoiceNum}`,
      message_ta: `${shop.name_ta} கடைக்கு புதிய டெலிவரி. விலைப்பட்டியல்: ${invoiceNum}`,
      status: 'unread',
      created_at: new Date().toISOString()
    });

    await writeDB(req.tenantId, db);
    res.status(201).json({ order: newOrder, items: orderItemsToCreate });
  } finally {
    releaseLock();
  }
});

app.get('/api/orders', async (req, res) => {
  const db = await readDB(req.tenantId);
  res.json(db.orders);
});

app.get('/api/orders/items', async (req, res) => {
  const db = await readDB(req.tenantId);
  res.json(db.order_items);
});

// Deliveries Management
app.get('/api/deliveries', async (req, res) => {
  const db = await readDB(req.tenantId);
  res.json(db.deliveries);
});

app.post('/api/deliveries/:id/complete', async (req, res) => {
  await acquireLock();
  try {
    const db = await readDB(req.tenantId);
    const deliveryIndex = db.deliveries.findIndex(d => d.id === req.params.id);
    if (deliveryIndex === -1) {
      return res.status(404).json({ error: 'Delivery not found' });
    }
    
    const delivery = db.deliveries[deliveryIndex];
    delivery.status = 'delivered';
    delivery.delivery_time = new Date().toISOString();
    delivery.remarks = req.body.remarks || 'Delivered successfully';

    // Update order status to delivered
    const order = db.orders.find(o => o.id === delivery.order_id);
    if (order) {
      order.status = 'delivered';
      
      // Auto-create bill log
      db.bills.push({
        id: `bill_${Date.now()}`,
        order_id: order.id,
        invoice_number: order.invoice_number,
        pdf_path: `/invoices/${order.invoice_number}.pdf`,
        shared_status: 'none',
        date: new Date().toISOString()
      });
    }

    await writeDB(req.tenantId, db);
    res.json(delivery);
  } finally {
    releaseLock();
  }
});

// Payments & Outstanding Collection
app.get('/api/payments', async (req, res) => {
  const db = await readDB(req.tenantId);
  res.json(db.payments);
});

app.post('/api/payments', async (req, res) => {
  await acquireLock();
  try {
    const db = await readDB(req.tenantId);
    const { shop_id, order_id, collected_amount, payment_mode, transaction_number } = req.body;
    
    const shop = db.shops.find(s => s.id === shop_id);
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    const colAmt = Number(collected_amount || 0);
    shop.outstanding_amount -= colAmt;

    const newPayment = {
      id: `pay_${Date.now()}`,
      shop_id,
      order_id: order_id || '',
      collected_amount: colAmt,
      payment_mode,
      transaction_number: transaction_number || `TXN-${Date.now()}`,
      payment_date: new Date().toISOString()
    };
    
    db.payments.push(newPayment);

    // Log in outstanding history
    db.outstanding_history.push({
      id: `oh_${Date.now()}`,
      shop_id,
      change_amount: -colAmt,
      balance_amount: shop.outstanding_amount,
      description: `Payment received via ${payment_mode.toUpperCase()}`,
      date: new Date().toISOString()
    });

    await writeDB(req.tenantId, db);
    res.status(201).json({ payment: newPayment, outstanding_amount: shop.outstanding_amount });
  } finally {
    releaseLock();
  }
});

app.get('/api/outstanding/history', async (req, res) => {
  const db = await readDB(req.tenantId);
  res.json(db.outstanding_history);
});

// Notifications
app.get('/api/notifications', async (req, res) => {
  const db = await readDB(req.tenantId);
  res.json(db.notifications);
});

app.post('/api/notifications/mark-read', async (req, res) => {
  await acquireLock();
  try {
    const db = await readDB(req.tenantId);
    db.notifications.forEach(n => {
      n.status = 'read';
    });
    await writeDB(req.tenantId, db);
    res.json({ success: true });
  } finally {
    releaseLock();
  }
});

// Reports Engine
app.get('/api/reports/summary', async (req, res) => {
  const db = await readDB(req.tenantId);
  
  // 1. Daily Sales Summary (today)
  const today = new Date().toISOString().split('T')[0];
  const todayOrders = db.orders.filter(o => o.order_date.startsWith(today));
  const todaySales = todayOrders.reduce((sum, o) => sum + o.net_amount, 0);

  // 2. Outstanding Report
  const totalOutstanding = db.shops.reduce((sum, s) => sum + s.outstanding_amount, 0);

  // 3. Purchase Cost & Sales Cost to compute Profit
  let totalCost = 0;
  let totalRevenue = 0;

  db.order_items.forEach(item => {
    const p = db.products.find(prod => prod.id === item.product_id);
    if (p) {
      const qtyBottles = (item.cases * p.case_qty_rule) + item.bottles;
      const itemCost = qtyBottles * (p.purchase_price / p.case_qty_rule);
      totalCost += itemCost;
      totalRevenue += item.amount;
    }
  });

  const grossProfit = Math.round(totalRevenue - totalCost);

  // 4. Low stock count
  const lowStockCount = db.products.filter(p => p.current_stock_bottles <= p.min_stock && p.status === 'active').length;

  res.json({
    todaySales,
    todayOrdersCount: todayOrders.length,
    totalOutstanding,
    grossProfit,
    lowStockCount
  });
});

// Deletion & Rollback Endpoints (Soft Delete to Recycle Bin for 30 Days)

// 1. Delete Shop
app.delete('/api/shops/:id', async (req, res) => {
  await acquireLock();
  try {
    const db = await readDB(req.tenantId);
    const shopId = req.params.id;
    // Check if shop has orders
    const hasOrders = db.orders.some(o => o.shop_id === shopId);
    if (hasOrders) {
      return res.status(400).json({ error: 'Cannot delete shop with existing orders. Please cancel/delete orders first.' });
    }
    const shop = db.shops.find(s => s.id === shopId);
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    db.shops = db.shops.filter(s => s.id !== shopId);
    const relatedHistory = db.outstanding_history.filter(oh => oh.shop_id === shopId);
    db.outstanding_history = db.outstanding_history.filter(oh => oh.shop_id !== shopId);

    if (!db.recycle_bin) db.recycle_bin = [];
    db.recycle_bin.push({
      id: `rb_${Date.now()}_sp`,
      table: 'shops',
      original_id: shopId,
      data: { shop, relatedHistory },
      deleted_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    });

    await writeDB(req.tenantId, db);
    res.json({ success: true });
  } finally {
    releaseLock();
  }
});

// 2. Delete Product
app.delete('/api/products/:id', async (req, res) => {
  await acquireLock();
  try {
    const db = await readDB(req.tenantId);
    const productId = req.params.id;
    // Check if product has order items or purchases
    const hasOrders = db.order_items.some(oi => oi.product_id === productId);
    const hasPurchases = db.purchases.some(p => p.product_id === productId);
    if (hasOrders || hasPurchases) {
      return res.status(400).json({ error: 'Cannot delete product with sales or purchase history.' });
    }
    const product = db.products.find(p => p.id === productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    db.products = db.products.filter(p => p.id !== productId);
    const relatedLedger = db.stock_ledger.filter(sl => sl.product_id === productId);
    db.stock_ledger = db.stock_ledger.filter(sl => sl.product_id !== productId);

    if (!db.recycle_bin) db.recycle_bin = [];
    db.recycle_bin.push({
      id: `rb_${Date.now()}_pd`,
      table: 'products',
      original_id: productId,
      data: { product, relatedLedger },
      deleted_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    });

    await writeDB(req.tenantId, db);
    res.json({ success: true });
  } finally {
    releaseLock();
  }
});

// 3. Delete Purchase (Supplier Stock Entry Rollback)
app.delete('/api/purchases/:id', async (req, res) => {
  await acquireLock();
  try {
    const db = await readDB(req.tenantId);
    const purchaseId = req.params.id;
    const purchase = db.purchases.find(p => p.id === purchaseId);
    if (!purchase) {
      return res.status(404).json({ error: 'Purchase record not found' });
    }
    const product = db.products.find(p => p.id === purchase.product_id);
    if (!product) {
      return res.status(404).json({ error: 'Associated product not found' });
    }

    const qtyToSubtract = (purchase.cases * product.case_qty_rule) + purchase.bottles;
    if (product.current_stock_bottles < qtyToSubtract) {
      return res.status(400).json({
        error: `Cannot delete purchase. Subtracting ${qtyToSubtract} bottles would cause negative stock. Current available: ${product.current_stock_bottles} bottles.`
      });
    }

    // Rollback stock
    product.current_stock_bottles -= qtyToSubtract;

    // Delete purchase record
    db.purchases = db.purchases.filter(p => p.id !== purchaseId);

    // Ledger rollback log
    const ledgerEntry = {
      id: `sl_${Date.now()}_del`,
      product_id: product.id,
      transaction_type: 'purchase_cancel',
      cases_change: -purchase.cases,
      bottles_change: -purchase.bottles,
      running_stock_bottles: product.current_stock_bottles,
      timestamp: new Date().toISOString()
    };
    db.stock_ledger.push(ledgerEntry);

    if (!db.recycle_bin) db.recycle_bin = [];
    db.recycle_bin.push({
      id: `rb_${Date.now()}_pc`,
      table: 'purchases',
      original_id: purchaseId,
      data: { purchase, ledgerEntry },
      deleted_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    });

    await writeDB(req.tenantId, db);
    res.json({ success: true });
  } finally {
    releaseLock();
  }
});

// 4. Cancel & Delete Order (Sales Order Rollback)
app.delete('/api/orders/:id', async (req, res) => {
  await acquireLock();
  try {
    const db = await readDB(req.tenantId);
    const orderId = req.params.id;
    const orderIndex = db.orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const order = db.orders[orderIndex];
    const shop = db.shops.find(s => s.id === order.shop_id);

    // Rollback stock for each item in the order
    const oItems = db.order_items.filter(oi => oi.order_id === orderId);
    const ledgerEntries = [];
    for (const item of oItems) {
      const product = db.products.find(p => p.id === item.product_id);
      if (product) {
        const qtyToAdd = (item.cases * product.case_qty_rule) + item.bottles;
        product.current_stock_bottles += qtyToAdd;

        const ledgerEntry = {
          id: `sl_${Date.now()}_ord_del_${item.product_id}`,
          product_id: product.id,
          transaction_type: 'sale_cancel',
          cases_change: item.cases,
          bottles_change: item.bottles,
          running_stock_bottles: product.current_stock_bottles,
          timestamp: new Date().toISOString()
        };
        db.stock_ledger.push(ledgerEntry);
        ledgerEntries.push(ledgerEntry);
      }
    }

    // Rollback outstanding amount
    const outstandingEntries = [];
    if (shop) {
      shop.outstanding_amount -= order.net_amount;
      const oe = {
        id: `oh_${Date.now()}_ord_del`,
        shop_id: shop.id,
        change_amount: -order.net_amount,
        balance_amount: shop.outstanding_amount,
        description: `Order ${order.invoice_number} cancelled/deleted`,
        date: new Date().toISOString()
      };
      db.outstanding_history.push(oe);
      outstandingEntries.push(oe);
    }

    // Capture payment reversals and cascades
    const deliveries = db.deliveries.filter(d => d.order_id === orderId);
    const bills = db.bills.filter(b => b.order_id === orderId);
    const orderPayments = db.payments.filter(p => p.order_id === orderId);

    for (const p of orderPayments) {
      if (shop) {
        shop.outstanding_amount += p.collected_amount; // add back what was collected
        const pe = {
          id: `oh_${Date.now()}_pay_rev_${p.id}`,
          shop_id: shop.id,
          change_amount: p.collected_amount,
          balance_amount: shop.outstanding_amount,
          description: `Payment transaction ${p.transaction_number} reversed due to order cancellation`,
          date: new Date().toISOString()
        };
        db.outstanding_history.push(pe);
        outstandingEntries.push(pe);
      }
    }

    // Remove active entries
    db.orders.splice(orderIndex, 1);
    db.order_items = db.order_items.filter(oi => oi.order_id !== orderId);
    db.deliveries = db.deliveries.filter(d => d.order_id !== orderId);
    db.bills = db.bills.filter(b => b.order_id !== orderId);
    db.payments = db.payments.filter(p => p.order_id !== orderId);

    if (!db.recycle_bin) db.recycle_bin = [];
    db.recycle_bin.push({
      id: `rb_${Date.now()}_or`,
      table: 'orders',
      original_id: orderId,
      data: {
        order,
        order_items: oItems,
        deliveries,
        bills,
        payments: orderPayments,
        ledgerEntries,
        outstandingEntries
      },
      deleted_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    });

    await writeDB(req.tenantId, db);
    res.json({ success: true });
  } finally {
    releaseLock();
  }
});

// Recycle Bin Endpoints
app.get('/api/recycle-bin', async (req, res) => {
  const db = await readDB(req.tenantId);
  if (!db.recycle_bin) db.recycle_bin = [];
  res.json(db.recycle_bin);
});

app.post('/api/recycle-bin/:id/restore', async (req, res) => {
  await acquireLock();
  try {
    const db = await readDB(req.tenantId);
    const itemId = req.params.id;
    const item = db.recycle_bin.find(rb => rb.id === itemId);
    if (!item) {
      return res.status(404).json({ error: 'Item not found in Recycle Bin' });
    }

    if (item.table === 'routes') {
      db.routes.push(item.data);
    } else if (item.table === 'shops') {
      const { shop, relatedHistory } = item.data;
      if (!db.routes.some(r => r.id === shop.route_id)) {
        return res.status(400).json({ error: 'Cannot restore shop. Assigned route no longer exists.' });
      }
      db.shops.push(shop);
      db.outstanding_history.push(...relatedHistory);
    } else if (item.table === 'products') {
      const { product, relatedLedger } = item.data;
      db.products.push(product);
      db.stock_ledger.push(...relatedLedger);
    } else if (item.table === 'purchases') {
      const { purchase, ledgerEntry } = item.data;
      const product = db.products.find(p => p.id === purchase.product_id);
      if (!product) {
        return res.status(400).json({ error: 'Cannot restore purchase. Product no longer exists.' });
      }
      const qtyToAdd = (purchase.cases * product.case_qty_rule) + purchase.bottles;
      product.current_stock_bottles += qtyToAdd;

      db.purchases.push(purchase);
      db.stock_ledger = db.stock_ledger.filter(sl => sl.id !== ledgerEntry.id);
      db.stock_ledger.push({
        id: `sl_${Date.now()}_restore`,
        product_id: product.id,
        transaction_type: 'purchase_restore',
        cases_change: purchase.cases,
        bottles_change: purchase.bottles,
        running_stock_bottles: product.current_stock_bottles,
        timestamp: new Date().toISOString()
      });
    } else if (item.table === 'orders') {
      const {
        order,
        order_items: oItems,
        deliveries,
        bills,
        payments: orderPayments,
        ledgerEntries,
        outstandingEntries
      } = item.data;

      const shop = db.shops.find(s => s.id === order.shop_id);
      if (!shop) {
        return res.status(400).json({ error: 'Cannot restore order. Shop no longer exists.' });
      }

      // Check stock availability before restoring order
      for (const item of oItems) {
        const product = db.products.find(p => p.id === item.product_id);
        if (product) {
          const qtyToSub = (item.cases * product.case_qty_rule) + item.bottles;
          if (product.current_stock_bottles < qtyToSub) {
            return res.status(400).json({
              error: `Cannot restore order. Product ${product.name_en} has insufficient stock. Need: ${qtyToSub} bottles, Available: ${product.current_stock_bottles}.`
            });
          }
          product.current_stock_bottles -= qtyToSub;

          db.stock_ledger.push({
            id: `sl_${Date.now()}_rest_item_${product.id}`,
            product_id: product.id,
            transaction_type: 'sale',
            cases_change: -item.cases,
            bottles_change: -item.bottles,
            running_stock_bottles: product.current_stock_bottles,
            timestamp: new Date().toISOString()
          });
        }
      }

      shop.outstanding_amount += order.net_amount;

      // Filter rollback entries
      const ledgerIds = ledgerEntries.map(e => e.id);
      const outstandingIds = outstandingEntries.map(e => e.id);
      db.stock_ledger = db.stock_ledger.filter(sl => !ledgerIds.includes(sl.id));
      db.outstanding_history = db.outstanding_history.filter(oh => !outstandingIds.includes(oh.id));

      db.orders.push(order);
      db.order_items.push(...oItems);
      db.deliveries.push(...deliveries);
      db.bills.push(...bills);
      db.payments.push(...orderPayments);

      for (const p of orderPayments) {
        shop.outstanding_amount -= p.collected_amount;
      }

      db.outstanding_history.push({
        id: `oh_${Date.now()}_rest_ord`,
        shop_id: shop.id,
        change_amount: order.net_amount,
        balance_amount: shop.outstanding_amount,
        description: `Order ${order.invoice_number} restored from Recycle Bin`,
        date: new Date().toISOString()
      });
    }

    db.recycle_bin = db.recycle_bin.filter(rb => rb.id !== itemId);
    await writeDB(req.tenantId, db);
    res.json({ success: true });
  } finally {
    releaseLock();
  }
});

app.delete('/api/recycle-bin/:id', async (req, res) => {
  await acquireLock();
  try {
    const db = await readDB(req.tenantId);
    db.recycle_bin = db.recycle_bin.filter(rb => rb.id !== req.params.id);
    await writeDB(req.tenantId, db);
    res.json({ success: true });
  } finally {
    releaseLock();
  }
});

// Auto cleanup cron for expired recycle bin items (older than 30 days)
async function cleanupRecycleBin(tenantId) {
  if (!tenantId) return;
  await acquireLock();
  try {
    const db = await readDB(req.tenantId);
    if (!db.recycle_bin) db.recycle_bin = [];
    const now = new Date().toISOString();
    const lenBefore = db.recycle_bin.length;
    db.recycle_bin = db.recycle_bin.filter(rb => rb.expires_at > now);
    if (db.recycle_bin.length !== lenBefore) {
      await writeDB(req.tenantId, db);
      console.log(`Recycle Bin Cleanup: Permanently purged ${lenBefore - db.recycle_bin.length} expired items.`);
    }
  } catch (err) {
    console.error('Recycle Bin Cleanup Error:', err);
  } finally {
    releaseLock();
  }
}

// ---------------- VEHICLE DIRECT SALES API ----------------

// 1. Get all vehicles
app.get('/api/vehicles', async (req, res) => {
  const db = await readDB(req.tenantId);
  res.json(db.vehicles || []);
});

// 2. Create vehicle
app.post('/api/vehicles', async (req, res) => {
  await acquireLock();
  try {
    const db = await readDB(req.tenantId);
    const newVehicle = {
      id: `v_${Date.now()}`,
      vehicle_number: req.body.vehicle_number,
      driver_name: req.body.driver_name,
      salesman_id: req.body.salesman_id || '',
      status: req.body.status || 'active'
    };
    db.vehicles.push(newVehicle);
    await writeDB(req.tenantId, db);
    res.status(201).json(newVehicle);
  } finally {
    releaseLock();
  }
});

// 3. Update vehicle
app.put('/api/vehicles/:id', async (req, res) => {
  await acquireLock();
  try {
    const db = await readDB(req.tenantId);
    const idx = db.vehicles.findIndex(v => v.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    db.vehicles[idx] = { ...db.vehicles[idx], ...req.body };
    await writeDB(req.tenantId, db);
    res.json(db.vehicles[idx]);
  } finally {
    releaseLock();
  }
});

// 4. Delete vehicle
app.delete('/api/vehicles/:id', async (req, res) => {
  await acquireLock();
  try {
    const db = await readDB(req.tenantId);
    db.vehicles = db.vehicles.filter(v => v.id !== req.params.id);
    if (db.vehicle_stock) {
      db.vehicle_stock = db.vehicle_stock.filter(s => s.vehicle_id !== req.params.id);
    }
    await writeDB(req.tenantId, db);
    res.json({ success: true });
  } finally {
    releaseLock();
  }
});

// 5. Get current vehicle stock
app.get('/api/vehicles/stock', async (req, res) => {
  const db = await readDB(req.tenantId);
  res.json(db.vehicle_stock || []);
});

// 6. Get dispatches
app.get('/api/vehicles/dispatches', async (req, res) => {
  const db = await readDB(req.tenantId);
  res.json(db.vehicle_dispatches || []);
});

// 7. Dispatch stock to vehicle
app.post('/api/vehicles/dispatch', async (req, res) => {
  await acquireLock();
  try {
    const db = await readDB(req.tenantId);
    const { vehicle_id, items } = req.body; // items: array of { product_id, cases, bottles }
    
    // Check if vehicle exists
    const vehicle = db.vehicles.find(v => v.id === vehicle_id);
    if (!vehicle) {
      return res.status(400).json({ error: 'Vehicle not found' });
    }

    // Verify stock availability in warehouse
    for (const item of items) {
      const product = db.products.find(p => p.id === item.product_id);
      if (!product) {
        return res.status(400).json({ error: `Product not found: ${item.product_id}` });
      }
      const totalRequestedBottles = (Number(item.cases || 0) * product.case_qty_rule) + Number(item.bottles || 0);
      if (product.current_stock_bottles < totalRequestedBottles) {
        return res.status(400).json({ 
          error: `Insufficient warehouse stock for ${product.name_en}. Requested: ${totalRequestedBottles} bottles, Available: ${product.current_stock_bottles} bottles` 
        });
      }
    }

    const dispatchItems = [];
    // Process stock movement
    for (const item of items) {
      const product = db.products.find(p => p.id === item.product_id);
      const totalBottles = (Number(item.cases || 0) * product.case_qty_rule) + Number(item.bottles || 0);
      if (totalBottles === 0) continue;

      // Deduct from warehouse
      product.current_stock_bottles -= totalBottles;

      // Add to vehicle stock
      let vStock = db.vehicle_stock.find(s => s.vehicle_id === vehicle_id && s.product_id === item.product_id);
      if (!vStock) {
        vStock = {
          id: `vs_${Date.now()}_${item.product_id}`,
          vehicle_id,
          product_id: item.product_id,
          current_stock_bottles: 0
        };
        db.vehicle_stock.push(vStock);
      }
      vStock.current_stock_bottles += totalBottles;

      // Log in main stock ledger
      db.stock_ledger.push({
        id: `sl_${Date.now()}_disp_${item.product_id}`,
        product_id: item.product_id,
        transaction_type: 'vehicle_dispatch',
        cases_change: -Number(item.cases || 0),
        bottles_change: -Number(item.bottles || 0),
        running_stock_bottles: product.current_stock_bottles,
        timestamp: new Date().toISOString()
      });

      dispatchItems.push({
        product_id: item.product_id,
        cases: Number(item.cases || 0),
        bottles: Number(item.bottles || 0),
        total_bottles: totalBottles
      });
    }

    const newDispatch = {
      id: `vd_${Date.now()}`,
      vehicle_id,
      dispatch_date: new Date().toISOString(),
      items: dispatchItems
    };
    db.vehicle_dispatches.push(newDispatch);

    await writeDB(req.tenantId, db);
    res.status(201).json(newDispatch);
  } finally {
    releaseLock();
  }
});

// 8. Get vehicle sales
app.get('/api/vehicles/sales', async (req, res) => {
  const db = await readDB(req.tenantId);
  res.json(db.vehicle_sales || []);
});

// 9. Record vehicle sale
app.post('/api/vehicles/sales', async (req, res) => {
  await acquireLock();
  try {
    const db = await readDB(req.tenantId);
    const { vehicle_id, shop_id, salesman_id, items, discount, payment_mode, upi_reference } = req.body;
    // items: array of { product_id, cases, bottles, price }

    const shop = db.shops.find(s => s.id === shop_id);
    if (!shop) {
      return res.status(400).json({ error: 'Shop not found' });
    }

    // Verify vehicle stock
    for (const item of items) {
      const product = db.products.find(p => p.id === item.product_id);
      if (!product) {
        return res.status(400).json({ error: `Product not found: ${item.product_id}` });
      }
      const totalReq = (Number(item.cases || 0) * product.case_qty_rule) + Number(item.bottles || 0);
      const vStock = db.vehicle_stock.find(s => s.vehicle_id === vehicle_id && s.product_id === item.product_id);
      const vStockQty = vStock ? vStock.current_stock_bottles : 0;
      if (vStockQty < totalReq) {
        return res.status(400).json({
          error: `Insufficient stock on vehicle for ${product.name_en}. Requested: ${totalReq} bottles, On Vehicle: ${vStockQty} bottles`
        });
      }
    }

    let totalAmount = 0;
    const saleItems = [];

    // Deduct stock and compile items
    for (const item of items) {
      const product = db.products.find(p => p.id === item.product_id);
      const totalBottles = (Number(item.cases || 0) * product.case_qty_rule) + Number(item.bottles || 0);
      if (totalBottles === 0) continue;

      const vStock = db.vehicle_stock.find(s => s.vehicle_id === vehicle_id && s.product_id === item.product_id);
      vStock.current_stock_bottles -= totalBottles;

      const subtotal = totalBottles * (item.price || 0);
      totalAmount += subtotal;

      saleItems.push({
        product_id: item.product_id,
        cases: Number(item.cases || 0),
        bottles: Number(item.bottles || 0),
        price: Number(item.price || 0),
        total_bottles: totalBottles,
        subtotal
      });
    }

    const disc = Number(discount || 0);
    const netAmount = Math.max(0, totalAmount - disc);

    // Generate Invoice Number
    const seq = db.vehicle_sales.length + 1;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const invoiceNum = `DS-${dateStr}-${String(seq).padStart(4, '0')}`;

    // Handle Payment Mode
    if (payment_mode === 'credit') {
      shop.outstanding_amount = Number(shop.outstanding_amount || 0) + netAmount;
      db.outstanding_history.push({
        id: `oh_${Date.now()}_ds`,
        shop_id: shop.id,
        change_amount: netAmount,
        balance_amount: shop.outstanding_amount,
        description: `Direct Sale Invoice ${invoiceNum}`,
        date: new Date().toISOString()
      });
    }

    const newSale = {
      id: `vs_${Date.now()}`,
      invoice_number: invoiceNum,
      vehicle_id,
      salesman_id,
      shop_id,
      sale_date: new Date().toISOString(),
      items: saleItems,
      discount: disc,
      net_amount: netAmount,
      payment_mode,
      upi_reference: upi_reference || ''
    };

    db.vehicle_sales.push(newSale);

    await writeDB(req.tenantId, db);
    res.status(201).json(newSale);
  } finally {
    releaseLock();
  }
});

// 10. Get reconciliations
app.get('/api/vehicles/reconciliations', async (req, res) => {
  const db = await readDB(req.tenantId);
  res.json(db.vehicle_reconciliations || []);
});

// 11. Reconcile / Return stock
app.post('/api/vehicles/reconcile', async (req, res) => {
  await acquireLock();
  try {
    const db = await readDB(req.tenantId);
    const { vehicle_id } = req.body;
    const vStocks = db.vehicle_stock.filter(s => s.vehicle_id === vehicle_id && s.current_stock_bottles > 0);

    if (vStocks.length === 0) {
      return res.status(400).json({ error: 'No stock left on the vehicle to reconcile' });
    }

    const returnedItems = [];
    for (const vStock of vStocks) {
      const product = db.products.find(p => p.id === vStock.product_id);
      if (!product) continue;

      const qty = vStock.current_stock_bottles;
      
      // Return to warehouse
      product.current_stock_bottles += qty;

      // Log in main stock ledger
      const cases = Math.floor(qty / product.case_qty_rule);
      const bottles = qty % product.case_qty_rule;

      db.stock_ledger.push({
        id: `sl_${Date.now()}_recon_${product.id}`,
        product_id: product.id,
        transaction_type: 'vehicle_reconciliation_return',
        cases_change: cases,
        bottles_change: bottles,
        running_stock_bottles: product.current_stock_bottles,
        timestamp: new Date().toISOString()
      });

      returnedItems.push({
        product_id: product.id,
        cases,
        bottles,
        total_bottles: qty
      });

      // Clear vehicle stock
      vStock.current_stock_bottles = 0;
    }

    const newRecon = {
      id: `vr_${Date.now()}`,
      vehicle_id,
      reconciliation_date: new Date().toISOString(),
      returned_items: returnedItems
    };
    db.vehicle_reconciliations.push(newRecon);

    await writeDB(req.tenantId, db);
    res.status(200).json(newRecon);
  } finally {
    releaseLock();
  }
});

// Launch server
const PORT = process.env.PORT || 5001;
if (!process.env.VERCEL) {
  app.listen(PORT, async () => {
    console.log(`Distribution Backend running on port ${PORT}`);
    // await cleanupRecycleBin();
  });
}

export default app;
