import React, { useState, useEffect } from 'react';
import api from '../api';

export default function VehicleDirectSales({ t, lang, onBillSelected, session }) {
  const [activeSubTab, setActiveSubTab] = useState('sales'); // 'vehicles' | 'dispatch' | 'sales' | 'reconcile' | 'reports'
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Lists
  const [vehicles, setVehicles] = useState([]);
  const [vehicleStock, setVehicleStock] = useState([]);
  const [products, setProducts] = useState([]);
  const [shops, setShops] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [reconciliations, setReconciliations] = useState([]);
  const [sales, setSales] = useState([]);
  const [users, setUsers] = useState([]);

  // Vehicles Form State
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [assignedSalesman, setAssignedSalesman] = useState('');
  const [vehicleStatus, setVehicleStatus] = useState('active');

  // Dispatch Form State
  const [selectedDispatchVehicle, setSelectedDispatchVehicle] = useState('');
  const [dispatchCart, setDispatchCart] = useState({}); // product_id -> { cases, bottles }

  // Sales Entry Form State
  const [selectedSaleVehicle, setSelectedSaleVehicle] = useState('');
  const [selectedSaleShop, setSelectedSaleShop] = useState('');
  const [saleCart, setSaleCart] = useState({}); // product_id -> { cases, bottles, price }
  const [saleDiscount, setSaleDiscount] = useState(0);
  const [paymentMode, setPaymentMode] = useState('cash');
  const [upiReference, setUpiReference] = useState('');

  // Selected invoice for preview modal
  const [activeInvoice, setActiveInvoice] = useState(null);

  // Reconciliation State
  const [selectedReconcileVehicle, setSelectedReconcileVehicle] = useState('');

  // Filter terms
  const [salesSearch, setSalesSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const currentUser = session;

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [
        vData,
        vsData,
        pData,
        sData,
        dispData,
        reconData,
        saleData,
        userData
      ] = await Promise.all([
        api.getVehicles(),
        api.getVehicleStock(),
        api.getProducts(),
        api.getShops(),
        api.getVehicleDispatches(),
        api.getVehicleReconciliations(),
        api.getVehicleSales(),
        api.getUsers()
      ]);

      setVehicles(vData);
      setVehicleStock(vsData);
      setProducts(pData);
      setShops(sData);
      setDispatches(dispData);
      setReconciliations(reconData);
      setSales(saleData);
      setUsers(userData);
    } catch (err) {
      console.error('Failed to load vehicle direct sales data', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper formatting stock
  const formatStock = (totalBottles, caseRule) => {
    const cases = Math.floor(totalBottles / caseRule);
    const bottles = totalBottles % caseRule;
    let result = '';
    if (cases > 0) result += `${cases} C`;
    if (bottles > 0) result += `${result ? ', ' : ''}${bottles} B`;
    return result || '0 B';
  };

  const getShopName = (shop) => {
    if (!shop) return '';
    return lang === 'ta' ? shop.name_ta || shop.name_en : shop.name_en;
  };

  const getProductName = (prod) => {
    if (!prod) return '';
    return lang === 'ta' ? prod.name_ta || prod.name_en : prod.name_en;
  };

  // ---------------- VEHICLE FORM ACTIONS ----------------
  const handleSaveVehicle = async (e) => {
    e.preventDefault();
    const payload = {
      vehicle_number: vehicleNumber,
      driver_name: driverName,
      salesman_id: assignedSalesman,
      status: vehicleStatus
    };

    try {
      if (editingVehicle) {
        const updated = await api.updateVehicle(editingVehicle.id, payload);
        setVehicles(vehicles.map(v => v.id === editingVehicle.id ? updated : v));
      } else {
        const added = await api.createVehicle(payload);
        setVehicles([...vehicles, added]);
      }
      resetVehicleForm();
    } catch (err) {
      alert('Error saving vehicle details');
    }
  };

  const handleEditVehicle = (veh) => {
    setEditingVehicle(veh);
    setVehicleNumber(veh.vehicle_number);
    setDriverName(veh.driver_name);
    setAssignedSalesman(veh.salesman_id);
    setVehicleStatus(veh.status);
  };

  const handleDeleteVehicle = async (id) => {
    if (window.confirm('Are you sure you want to delete this vehicle? / இந்த வாகனத்தை நீக்க வேண்டுமா?')) {
      try {
        await api.deleteVehicle(id);
        setVehicles(vehicles.filter(v => v.id !== id));
      } catch (err) {
        alert('Failed to delete vehicle');
      }
    }
  };

  const resetVehicleForm = () => {
    setEditingVehicle(null);
    setVehicleNumber('');
    setDriverName('');
    setAssignedSalesman('');
    setVehicleStatus('active');
  };

  // ---------------- DISPATCH STOCK ACTIONS ----------------
  const handleDispatchQtyChange = (prodId, field, val) => {
    const value = Math.max(0, parseInt(val) || 0);
    setDispatchCart({
      ...dispatchCart,
      [prodId]: {
        ...(dispatchCart[prodId] || { cases: 0, bottles: 0 }),
        [field]: value
      }
    });
  };

  const handleDispatchSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDispatchVehicle) return alert('Select a vehicle / வாகனத்தைத் தேர்ந்தெடுக்கவும்');

    const items = Object.keys(dispatchCart)
      .map(prodId => ({
        product_id: prodId,
        cases: dispatchCart[prodId].cases || 0,
        bottles: dispatchCart[prodId].bottles || 0
      }))
      .filter(item => item.cases > 0 || item.bottles > 0);

    if (items.length === 0) return alert('Add quantities to dispatch / ஏற்ற வேண்டிய அளவை உள்ளிடவும்');

    setSubmitting(true);
    try {
      await api.dispatchVehicleStock({
        vehicle_id: selectedDispatchVehicle,
        items
      });
      alert(lang === 'ta' ? 'சரக்கு வெற்றிகரமாக வாகனத்தில் ஏற்றப்பட்டது!' : 'Stock loaded onto vehicle successfully!');
      setDispatchCart({});
      loadAllData();
    } catch (err) {
      alert(err.message || 'Error executing dispatch');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------- SALES ENTRY ACTIONS ----------------
  const getProductVehicleStock = (vehicleId, productId) => {
    const stockItem = vehicleStock.find(s => s.vehicle_id === vehicleId && s.product_id === productId);
    return stockItem ? stockItem.current_stock_bottles : 0;
  };

  const handleSaleQtyChange = (prodId, field, val, maxBottles) => {
    const value = Math.max(0, parseInt(val) || 0);
    const prod = products.find(p => p.id === prodId);
    if (!prod) return;

    const currentItem = saleCart[prodId] || { cases: 0, bottles: 0, price: getWholesaleOrRetailPrice(prod, selectedSaleShop) };
    const updatedItem = { ...currentItem, [field]: value };
    const totalRequested = (updatedItem.cases * prod.case_qty_rule) + updatedItem.bottles;

    if (totalRequested > maxBottles && (field === 'cases' || field === 'bottles')) {
      alert(`Cannot exceed vehicle stock! Available: ${formatStock(maxBottles, prod.case_qty_rule)}`);
      return;
    }

    setSaleCart({
      ...saleCart,
      [prodId]: updatedItem
    });
  };

  const getWholesaleOrRetailPrice = (prod, shopId) => {
    const shop = shops.find(s => s.id === shopId);
    if (!shop) return prod.wholesale_price;
    return shop.shop_type === 'wholesale' ? prod.wholesale_price : prod.retail_price;
  };

  useEffect(() => {
    if (selectedSaleShop) {
      const newCart = {};
      Object.keys(saleCart).forEach(pid => {
        const prod = products.find(p => p.id === pid);
        if (prod) {
          newCart[pid] = {
            ...saleCart[pid],
            price: getWholesaleOrRetailPrice(prod, selectedSaleShop)
          };
        }
      });
      setSaleCart(newCart);
    }
  }, [selectedSaleShop]);

  const calculateSaleSubtotal = () => {
    let subtotal = 0;
    Object.keys(saleCart).forEach(pid => {
      const prod = products.find(p => p.id === pid);
      const item = saleCart[pid];
      if (prod && item) {
        const rate = Number(item.price || 0);
        const bottlesRate = rate / prod.case_qty_rule;
        subtotal += (item.cases * rate) + (item.bottles * bottlesRate);
      }
    });
    return Math.round(subtotal);
  };

  const handleSaleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSaleVehicle) return alert('Select vehicle / வாகனத்தைத் தேர்ந்தெடுக்கவும்');
    if (!selectedSaleShop) return alert('Select shop / கடையைத் தேர்வு செய்க');

    const items = Object.keys(saleCart)
      .map(pid => ({
        product_id: pid,
        cases: saleCart[pid].cases || 0,
        bottles: saleCart[pid].bottles || 0,
        price: saleCart[pid].price || 0
      }))
      .filter(item => item.cases > 0 || item.bottles > 0);

    if (items.length === 0) return alert('Add at least one item / ஒரு பொருளையாவது சேர்க்கவும்');

    setSubmitting(true);
    try {
      const result = await api.createVehicleSale({
        vehicle_id: selectedSaleVehicle,
        shop_id: selectedSaleShop,
        salesman_id: currentUser ? currentUser.id : 'u2',
        items,
        discount: Number(saleDiscount),
        payment_mode: paymentMode,
        upi_reference: upiReference
      });

      alert(lang === 'ta' ? 'விற்பனை வெற்றிகரமாகப் பதிவு செய்யப்பட்டது!' : 'Direct Sale recorded successfully!');
      setSaleCart({});
      setSaleDiscount(0);
      setUpiReference('');
      
      setActiveInvoice(result);
      loadAllData();
    } catch (err) {
      alert(err.message || 'Error processing direct sale');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------- RECONCILIATION ACTIONS ----------------
  const handleReconcileSubmit = async (e) => {
    e.preventDefault();
    if (!selectedReconcileVehicle) return alert('Select vehicle / வாகனத்தைத் தேர்ந்தெடுக்கவும்');

    const vehicleActiveStocks = vehicleStock.filter(
      s => s.vehicle_id === selectedReconcileVehicle && s.current_stock_bottles > 0
    );

    if (vehicleActiveStocks.length === 0) {
      return alert(lang === 'ta' ? 'இந்த வாகனத்தில் சமரசம் செய்ய சரக்குகள் ஏதும் இல்லை!' : 'No stock left on the vehicle to reconcile');
    }

    if (window.confirm('Return remaining stock to warehouse and reconcile? / வாகனத்தில் மீதமுள்ள சரக்குகளை சமரசம் செய்து கிடங்கிற்கு மாற்றவா?')) {
      setSubmitting(true);
      try {
        await api.reconcileVehicleStock({
          vehicle_id: selectedReconcileVehicle
        });
        alert(lang === 'ta' ? 'வாகன சரக்குகள் சமரசம் செய்யப்பட்டு வெற்றிகரமாக கிடங்கிற்கு மாற்றப்பட்டது!' : 'Vehicle stock reconciled and returned to warehouse successfully!');
        loadAllData();
      } catch (err) {
        alert(err.message || 'Error during reconciliation');
      } finally {
        setSubmitting(false);
      }
    }
  };

  const printActiveInvoice = () => {
    window.print();
  };

  if (loading) return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Loading Vehicle Module...</div>;

  return (
    <div>
      {/* Title */}
      <div style={{ marginBottom: '2rem' }} className="no-print">
        <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>🚚 {lang === 'ta' ? 'வாகன நேரடி விற்பனை மேலாண்மை' : 'Vehicle Direct Sales'}</h1>
        <p style={{ color: 'var(--text-muted)' }}>Load stock on vehicles, make direct sales to shops, check invoice bills, and reconcile returned stock</p>
      </div>

      {/* Internal Navigation Tabs */}
      <div className="no-print" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveSubTab('sales')}
          className={`sidebar-link ${activeSubTab === 'sales' ? 'active' : ''}`}
          style={{ width: 'auto', padding: '0.5rem 1rem' }}
        >
          🛒 {t('vehicle_direct_sales')}
        </button>
        <button
          onClick={() => setActiveSubTab('reconcile')}
          className={`sidebar-link ${activeSubTab === 'reconcile' ? 'active' : ''}`}
          style={{ width: 'auto', padding: '0.5rem 1rem' }}
        >
          ♻️ {t('reconcile_stock')}
        </button>
        <button
          onClick={() => setActiveSubTab('reports')}
          className={`sidebar-link ${activeSubTab === 'reports' ? 'active' : ''}`}
          style={{ width: 'auto', padding: '0.5rem 1rem' }}
        >
          📊 {t('vehicle_reports')}
        </button>
        {(currentUser?.role === 'admin' || !currentUser) && (
          <>
            <button
              onClick={() => setActiveSubTab('dispatch')}
              className={`sidebar-link ${activeSubTab === 'dispatch' ? 'active' : ''}`}
              style={{ width: 'auto', padding: '0.5rem 1rem' }}
            >
              📥 {t('dispatch_stock')}
            </button>
            <button
              onClick={() => setActiveSubTab('vehicles')}
              className={`sidebar-link ${activeSubTab === 'vehicles' ? 'active' : ''}`}
              style={{ width: 'auto', padding: '0.5rem 1rem' }}
            >
              🚚 {t('vehicles')}
            </button>
          </>
        )}
      </div>

      {/* -------------------- TAB: SALES ENTRY -------------------- */}
      {activeSubTab === 'sales' && (
        <div className="no-print">
          <div className="glass-card">
            <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>Direct Sales Invoice Form</h2>
            <form onSubmit={handleSaleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>{t('select_vehicle')}</label>
                  <select
                    className="form-select"
                    value={selectedSaleVehicle}
                    onChange={e => {
                      setSelectedSaleVehicle(e.target.value);
                      setSaleCart({});
                    }}
                    required
                  >
                    <option value="">-- Choose --</option>
                    {vehicles.filter(v => v.status === 'active').map(v => (
                      <option key={v.id} value={v.id}>{v.vehicle_number} ({v.driver_name})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>{t('select_shop')}</label>
                  <select
                    className="form-select"
                    value={selectedSaleShop}
                    onChange={e => setSelectedSaleShop(e.target.value)}
                    required
                  >
                    <option value="">-- Choose --</option>
                    {shops.filter(s => s.status === 'active').map(s => (
                      <option key={s.id} value={s.id}>{getShopName(s)} ({s.shop_type})</option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedSaleVehicle && selectedSaleShop && (
                <div style={{ marginTop: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Loaded Stock Items</h3>
                  
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                      <input
                        type="text"
                        placeholder="Filter by Product..."
                        className="form-input"
                        value={salesSearch}
                        onChange={e => setSalesSearch(e.target.value)}
                      />
                    </div>
                    <div style={{ width: '150px' }}>
                      <select className="form-select" value={brandFilter} onChange={e => setBrandFilter(e.target.value)}>
                        <option value="">All Brands</option>
                        {Array.from(new Set(products.map(p => p.brand))).map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ width: '150px' }}>
                      <select className="form-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                        <option value="">All Categories</option>
                        {Array.from(new Set(products.filter(p => p.category).map(p => p.category))).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Product details</th>
                          <th>Loaded Stock</th>
                          <th>Price Rate (₹ / Case)</th>
                          <th style={{ width: '120px' }}>Sell Cases</th>
                          <th style={{ width: '120px' }}>Sell Bottles</th>
                          <th style={{ textAlign: 'right' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products
                          .filter(p => p.status === 'active')
                          .filter(p => !salesSearch || p.name_en.toLowerCase().includes(salesSearch.toLowerCase()) || (p.name_ta && p.name_ta.includes(salesSearch)))
                          .filter(p => !brandFilter || p.brand === brandFilter)
                          .filter(p => !categoryFilter || p.category === categoryFilter)
                          .map(p => {
                            const maxBottles = getProductVehicleStock(selectedSaleVehicle, p.id);
                            if (maxBottles === 0) return null;

                            const item = saleCart[p.id] || { cases: 0, bottles: 0, price: getWholesaleOrRetailPrice(p, selectedSaleShop) };
                            const calculatedItemSub = Math.round(
                              (item.cases * Number(item.price || 0)) +
                              (item.bottles * (Number(item.price || 0) / p.case_qty_rule))
                            );

                            return (
                              <tr key={p.id}>
                                <td>
                                  <div style={{ fontWeight: '700' }}>{getProductName(p)}</div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.brand} | {p.category || 'N/A'} | {p.size}</div>
                                </td>
                                <td style={{ color: 'var(--success)', fontWeight: 'bold' }}>
                                  {formatStock(maxBottles, p.case_qty_rule)} ({maxBottles} B)
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-input"
                                    style={{ width: '90px', padding: '0.25rem' }}
                                    value={item.price}
                                    onChange={e => handleSaleQtyChange(p.id, 'price', e.target.value, maxBottles)}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-input"
                                    style={{ padding: '0.25rem' }}
                                    value={item.cases || ''}
                                    onChange={e => handleSaleQtyChange(p.id, 'cases', e.target.value, maxBottles)}
                                    placeholder="Cases"
                                    min="0"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-input"
                                    style={{ padding: '0.25rem' }}
                                    value={item.bottles || ''}
                                    onChange={e => handleSaleQtyChange(p.id, 'bottles', e.target.value, maxBottles)}
                                    placeholder="Bottles"
                                    min="0"
                                  />
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                  ₹{calculatedItemSub || 0}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                    <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }} className="glass-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                        <span>Subtotal:</span>
                        <strong>₹{calculateSaleSubtotal()}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Discount:</span>
                        <input
                          type="number"
                          className="form-input"
                          style={{ width: '100px', padding: '0.25rem' }}
                          value={saleDiscount}
                          onChange={e => setSaleDiscount(Math.max(0, Number(e.target.value)))}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                        <span>Net Total:</span>
                        <strong style={{ fontSize: '1.2rem', color: 'var(--accent-cyan)' }}>₹{Math.max(0, calculateSaleSubtotal() - saleDiscount)}</strong>
                      </div>

                      <div className="form-group">
                        <label>{t('payment_mode')}</label>
                        <select className="form-select" value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                          <option value="cash">{t('cash')}</option>
                          <option value="upi">{t('gpay')}</option>
                          <option value="credit">Credit / Outstanding</option>
                        </select>
                      </div>

                      {paymentMode === 'upi' && (
                        <div className="form-group">
                          <label>{t('transaction_id')}</label>
                          <input
                            type="text"
                            className="form-input"
                            value={upiReference}
                            onChange={e => setUpiReference(e.target.value)}
                            required
                            placeholder="Ref Number / UPI ID"
                          />
                        </div>
                      )}

                      <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }} disabled={submitting}>
                        {submitting ? 'Processing...' : '💳 Complete & Print Invoice'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* -------------------- TAB: DAY END RECONCILE -------------------- */}
      {activeSubTab === 'reconcile' && (
        <div className="no-print">
          <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>Vehicle Stock Reconciliation</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Select a vehicle to return all remaining loaded stock back to the warehouse inventory.
            </p>
            <form onSubmit={handleReconcileSubmit}>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label>Select Vehicle</label>
                <select
                  className="form-select"
                  value={selectedReconcileVehicle}
                  onChange={e => setSelectedReconcileVehicle(e.target.value)}
                  required
                >
                  <option value="">-- Choose --</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.vehicle_number} ({v.driver_name})</option>
                  ))}
                </select>
              </div>

              {selectedReconcileVehicle && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ marginBottom: '0.75rem', fontSize: '0.9rem' }}>Remaining Stock to Return:</h4>
                  <div className="table-container">
                    <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Stock on Vehicle</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map(p => {
                          const qty = getProductVehicleStock(selectedReconcileVehicle, p.id);
                          if (qty === 0) return null;
                          return (
                            <tr key={p.id}>
                              <td>{getProductName(p)}</td>
                              <td style={{ fontWeight: 'bold', color: 'var(--warning)' }}>
                                {formatStock(qty, p.case_qty_rule)} ({qty} B)
                              </td>
                            </tr>
                          );
                        })}
                        {vehicleStock.filter(s => s.vehicle_id === selectedReconcileVehicle && s.current_stock_bottles > 0).length === 0 && (
                          <tr>
                            <td colSpan="2" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                              No stock loaded on this vehicle.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-secondary"
                style={{ width: '100%', padding: '0.75rem', fontWeight: 'bold' }}
                disabled={submitting}
              >
                {submitting ? 'Reconciling...' : '🔄 Return Remaining Stock & Finalize'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* -------------------- TAB: VEHICLES -------------------- */}
      {activeSubTab === 'vehicles' && (
        <div className="no-print">
          <div className="glass-card" style={{ marginBottom: '2rem' }}>
            <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>
              {editingVehicle ? t('edit_vehicle') : t('add_vehicle')}
            </h2>
            <form onSubmit={handleSaveVehicle}>
              <div className="form-grid">
                <div className="form-group">
                  <label>{t('vehicle_number')}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={vehicleNumber}
                    onChange={e => setVehicleNumber(e.target.value)}
                    required
                    placeholder="e.g. TN-45-A-1234"
                  />
                </div>

                <div className="form-group">
                  <label>{t('driver_name')}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={driverName}
                    onChange={e => setDriverName(e.target.value)}
                    required
                    placeholder="Driver's Full Name"
                  />
                </div>

                <div className="form-group">
                  <label>Assign Salesman</label>
                  <select
                    className="form-select"
                    value={assignedSalesman}
                    onChange={e => setAssignedSalesman(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Salesman --</option>
                    {users.filter(u => u.role === 'salesman' && u.active).map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Vehicle Status</label>
                  <select
                    className="form-select"
                    value={vehicleStatus}
                    onChange={e => setVehicleStatus(e.target.value)}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="btn-group" style={{ marginTop: '1.25rem' }}>
                {editingVehicle && (
                  <button type="button" className="btn btn-secondary" onClick={resetVehicleForm}>
                    {t('cancel')}
                  </button>
                )}
                <button type="submit" className="btn btn-primary">
                  💾 {t('save')}
                </button>
              </div>
            </form>
          </div>

          <div className="glass-card">
            <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>Registered Vehicles</h2>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Vehicle Number</th>
                    <th>Driver Name</th>
                    <th>Salesman Assigned</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map(v => {
                    const salesman = users.find(u => u.id === v.salesman_id);
                    return (
                      <tr key={v.id}>
                        <td style={{ fontWeight: 'bold' }}>{v.vehicle_number}</td>
                        <td>{v.driver_name}</td>
                        <td>{salesman ? salesman.name : <span style={{ color: 'var(--text-muted)' }}>None</span>}</td>
                        <td>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            border: `1px solid ${v.status === 'active' ? 'var(--success)' : 'var(--border-color)'}`,
                            background: v.status === 'active' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                            color: v.status === 'active' ? 'var(--success)' : 'var(--text-muted)'
                          }}>
                            {v.status === 'active' ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                            <button className="language-btn" onClick={() => handleEditVehicle(v)}>
                              ✏️ Edit
                            </button>
                            <button className="btn btn-danger" onClick={() => handleDeleteVehicle(v.id)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- TAB: LOAD DISPATCH -------------------- */}
      {activeSubTab === 'dispatch' && (
        <div className="no-print">
          <div className="glass-card">
            <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>Dispatch Warehouse Stock to Vehicle</h2>
            <form onSubmit={handleDispatchSubmit}>
              <div className="form-group" style={{ maxWidth: '400px', marginBottom: '1.5rem' }}>
                <label>Select Destination Vehicle</label>
                <select
                  className="form-select"
                  value={selectedDispatchVehicle}
                  onChange={e => setSelectedDispatchVehicle(e.target.value)}
                  required
                >
                  <option value="">-- Choose Active Vehicle --</option>
                  {vehicles.filter(v => v.status === 'active').map(v => (
                    <option key={v.id} value={v.id}>{v.vehicle_number} ({v.driver_name})</option>
                  ))}
                </select>
              </div>

              {selectedDispatchVehicle && (
                <div>
                  <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Select Quantities to Load</h3>
                  <div className="table-container">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Product details</th>
                          <th>Warehouse Stock</th>
                          <th style={{ width: '150px' }}>Load Cases</th>
                          <th style={{ width: '150px' }}>Load Bottles</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products
                          .filter(p => p.status === 'active')
                          .map(p => {
                            const cartItem = dispatchCart[p.id] || { cases: 0, bottles: 0 };
                            return (
                              <tr key={p.id}>
                                <td>
                                  <div style={{ fontWeight: '700' }}>{getProductName(p)}</div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.brand} | {p.size}</div>
                                </td>
                                <td>
                                  <strong>{formatStock(p.current_stock_bottles, p.case_qty_rule)}</strong> ({p.current_stock_bottles} B)
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-input"
                                    value={cartItem.cases || ''}
                                    placeholder="Cases"
                                    onChange={e => handleDispatchQtyChange(p.id, 'cases', e.target.value)}
                                    min="0"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-input"
                                    value={cartItem.bottles || ''}
                                    placeholder="Bottles"
                                    onChange={e => handleDispatchQtyChange(p.id, 'bottles', e.target.value)}
                                    min="0"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                      {submitting ? 'Processing Dispatch...' : '📥 Dispatch Stock to Vehicle'}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* -------------------- TAB: REPORTS -------------------- */}
      {activeSubTab === 'reports' && (
        <div className="no-print">
          <div className="glass-card" style={{ marginBottom: '2rem' }}>
            <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>Vehicle Stock Report</h2>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Loaded Stock Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicleStock.map(s => {
                    const veh = vehicles.find(v => v.id === s.vehicle_id);
                    const prod = products.find(p => p.id === s.product_id);
                    if (!veh || !prod || s.current_stock_bottles === 0) return null;

                    return (
                      <tr key={s.id}>
                        <td><strong>{veh.vehicle_number}</strong> ({veh.driver_name})</td>
                        <td>{getProductName(prod)} ({prod.size})</td>
                        <td>{prod.category || 'N/A'}</td>
                        <td style={{ color: 'var(--success)', fontWeight: 'bold' }}>
                          {formatStock(s.current_stock_bottles, prod.case_qty_rule)} ({s.current_stock_bottles} Bottles)
                        </td>
                      </tr>
                    );
                  })}
                  {vehicleStock.filter(s => s.current_stock_bottles > 0).length === 0 && (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No stock loaded on any active vehicles.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-card" style={{ marginBottom: '2rem' }}>
            <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>Direct Sales Log (Invoices)</h2>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Invoice No</th>
                    <th>Sale Date</th>
                    <th>Vehicle</th>
                    <th>Customer Shop</th>
                    <th>Net Amount</th>
                    <th>Payment Mode</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map(sale => {
                    const veh = vehicles.find(v => v.id === sale.vehicle_id);
                    const shop = shops.find(s => s.id === sale.shop_id);
                    return (
                      <tr key={sale.id}>
                        <td style={{ fontWeight: 'bold', color: 'var(--accent-cyan)' }}>{sale.invoice_number}</td>
                        <td>{new Date(sale.sale_date).toLocaleDateString()}</td>
                        <td>{veh ? veh.vehicle_number : 'Unknown'}</td>
                        <td>{shop ? getShopName(shop) : 'Unknown'}</td>
                        <td style={{ fontWeight: 'bold' }}>₹{sale.net_amount}</td>
                        <td>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            background: sale.payment_mode === 'cash' ? 'rgba(16, 185, 129, 0.1)' : sale.payment_mode === 'upi' ? 'rgba(6, 182, 212, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            color: sale.payment_mode === 'cash' ? 'var(--success)' : sale.payment_mode === 'upi' ? 'var(--accent-cyan)' : 'var(--danger)',
                            border: `1px solid ${sale.payment_mode === 'cash' ? 'var(--success)' : sale.payment_mode === 'upi' ? 'var(--accent-cyan)' : 'var(--danger)'}`
                          }}>
                            {sale.payment_mode}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="language-btn" onClick={() => setActiveInvoice(sale)}>
                            📄 View Bill
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {sales.length === 0 && (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No direct sales recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-card" style={{ marginBottom: '2rem' }}>
            <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>Stock Dispatch Logs</h2>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Dispatch Date</th>
                    <th>Vehicle</th>
                    <th>Product Items Loaded</th>
                  </tr>
                </thead>
                <tbody>
                  {[...dispatches].reverse().map(d => {
                    const veh = vehicles.find(v => v.id === d.vehicle_id);
                    return (
                      <tr key={d.id}>
                        <td>{new Date(d.dispatch_date).toLocaleString()}</td>
                        <td><strong>{veh ? veh.vehicle_number : 'Unknown'}</strong></td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            {d.items.map(item => {
                              const prod = products.find(p => p.id === item.product_id);
                              return (
                                <div key={item.product_id} style={{ fontSize: '0.85rem' }}>
                                  • {prod ? getProductName(prod) : 'Unknown'} ({prod?.size}) : <strong>{item.cases} C, {item.bottles} B</strong> ({item.total_bottles} Bottles)
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-card">
            <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>End-of-Day Reconciliation Logs</h2>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Date / Time</th>
                    <th>Vehicle</th>
                    <th>Returned Stock Items</th>
                  </tr>
                </thead>
                <tbody>
                  {[...reconciliations].reverse().map(r => {
                    const veh = vehicles.find(v => v.id === r.vehicle_id);
                    return (
                      <tr key={r.id}>
                        <td>{new Date(r.reconciliation_date).toLocaleString()}</td>
                        <td><strong>{veh ? veh.vehicle_number : 'Unknown'}</strong></td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            {r.returned_items.map(item => {
                              const prod = products.find(p => p.id === item.product_id);
                              return (
                                <div key={item.product_id} style={{ fontSize: '0.85rem' }}>
                                  • {prod ? getProductName(prod) : 'Unknown'} ({prod?.size}) : <strong>{item.cases} C, {item.bottles} B</strong>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- INVOICE PRINT PREVIEW MODAL -------------------- */}
      {activeInvoice && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.65)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          zIndex: 9999,
          padding: '2rem 1rem',
          overflowY: 'auto'
        }} className="modal-overlay">
          <div className="glass-card" style={{ maxWidth: '580px', width: '100%', background: 'var(--background-card)', padding: '2rem' }}>
            
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.1rem', margin: 0, color: '#fff' }}>📄 Direct Invoice Receipt</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-primary" onClick={printActiveInvoice} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                  🖨️ Print
                </button>
                <button className="btn btn-secondary" onClick={() => setActiveInvoice(null)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', color: '#fff' }}>
                  ❌ Close
                </button>
              </div>
            </div>

            <div className="invoice-card" style={{ border: '1px solid var(--border-color)', padding: '1.5rem', background: '#fff', color: '#000', borderRadius: '8px' }}>
              
              <div style={{ textAlign: 'center', marginBottom: '1.25rem', borderBottom: '1.5px dashed #000', paddingBottom: '0.75rem' }}>
                <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.4rem', letterSpacing: '1px', fontWeight: '800' }}>{t('company_name')}</h2>
                <p style={{ margin: '0 0 0.25rem 0', fontSize: '10px', color: '#334155' }}>{t('company_address')}</p>
                <p style={{ margin: 0, fontSize: '11px', fontWeight: 'bold' }}>{t('company_gst')}</p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                <div>
                  <p style={{ margin: '0 0 0.25rem 0' }}><strong>Invoice No:</strong> {activeInvoice.invoice_number}</p>
                  <p style={{ margin: '0 0 0.25rem 0' }}><strong>Date:</strong> {new Date(activeInvoice.sale_date).toLocaleString()}</p>
                  <p style={{ margin: 0 }}><strong>Vehicle:</strong> {vehicles.find(v => v.id === activeInvoice.vehicle_id)?.vehicle_number || ''}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: '0 0 0.25rem 0' }}><strong>Customer:</strong> {getShopName(shops.find(s => s.id === activeInvoice.shop_id))}</p>
                  <p style={{ margin: '0 0 0.25rem 0' }}><strong>Contact:</strong> {shops.find(s => s.id === activeInvoice.shop_id)?.mobile || ''}</p>
                  <p style={{ margin: 0 }}><strong>GSTIN:</strong> {shops.find(s => s.id === activeInvoice.shop_id)?.gst_number || 'N/A'}</p>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '1.25rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid #000' }}>
                    <th style={{ textAlign: 'left', padding: '4px 0' }}>Item Details</th>
                    <th style={{ textAlign: 'center', padding: '4px 0', width: '50px' }}>Cases</th>
                    <th style={{ textAlign: 'center', padding: '4px 0', width: '50px' }}>Bottles</th>
                    <th style={{ textAlign: 'right', padding: '4px 0', width: '80px' }}>Rate/C</th>
                    <th style={{ textAlign: 'right', padding: '4px 0', width: '80px' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {activeInvoice.items.map((item, idx) => {
                    const prod = products.find(p => p.id === item.product_id);
                    return (
                      <tr key={idx} style={{ borderBottom: '1px dashed #e2e8f0' }}>
                        <td style={{ padding: '6px 0' }}>{getProductName(prod)} ({prod?.size})</td>
                        <td style={{ textAlign: 'center', padding: '6px 0' }}>{item.cases || 0}</td>
                        <td style={{ textAlign: 'center', padding: '6px 0' }}>{item.bottles || 0}</td>
                        <td style={{ textAlign: 'right', padding: '6px 0' }}>₹{item.price}</td>
                        <td style={{ textAlign: 'right', padding: '6px 0', fontWeight: 'bold' }}>₹{item.subtotal}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1.5px solid #000', paddingTop: '8px', fontSize: '11px' }}>
                <div>
                  <p style={{ margin: '0 0 4px 0' }}>Payment Mode: <strong style={{ textTransform: 'uppercase' }}>{activeInvoice.payment_mode}</strong></p>
                  {activeInvoice.upi_reference && <p style={{ margin: 0 }}>UPI Ref: <strong>{activeInvoice.upi_reference}</strong></p>}
                </div>
                <div style={{ width: '160px', textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Subtotal:</span>
                    <span>₹{activeInvoice.net_amount + (activeInvoice.discount || 0)}</span>
                  </div>
                  {activeInvoice.discount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Discount:</span>
                      <span>-₹{activeInvoice.discount}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px', borderTop: '1px double #000', paddingTop: '4px' }}>
                    <span>Net Total:</span>
                    <span>₹{activeInvoice.net_amount}</span>
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: '2rem', borderTop: '1px dashed #000', paddingTop: '10px', fontSize: '9px', color: '#475569' }}>
                Thank you for your business! / வரவுக்கு நன்றி!
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
