import React, { useState, useEffect } from 'react';
import { translations } from './translations';
import api from './api';

// Components
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import RouteMgr from './components/RouteMgr';
import ShopMgr from './components/ShopMgr';
import ProductMgr from './components/ProductMgr';
import PurchaseMgr from './components/PurchaseMgr';
import StockMgr from './components/StockMgr';
import OrderTaking from './components/OrderTaking';
import DeliveryMgr from './components/DeliveryMgr';
import Reports from './components/Reports';
import Billing from './components/Billing';
import UserMgr from './components/UserMgr';
import RecycleBin from './components/RecycleBin';
import VehicleDirectSales from './components/VehicleDirectSales';
import SuperAdminDashboard from './components/SuperAdminDashboard';

export default function App() {
  const [lang, setLang] = useState('en'); // 'en' or 'ta'
  const [session, setSession] = useState(null); // logged in user session
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [menuHidden, setMenuHidden] = useState(() => window.innerWidth <= 768);

  // Theme state defaulting to light theme
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  useEffect(() => {
    document.body.className = theme === 'light' ? 'light-theme' : '';
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (session) {
      let unsubscribe = null;
      let pollingTimer = null;

      const setupRealtimeNotifications = async () => {
        try {
          const { db, isFirebaseConfigured } = await import('./firebase');
          const { doc, onSnapshot } = await import('firebase/firestore');

          if (isFirebaseConfigured && db) {
            unsubscribe = onSnapshot(doc(db, 'tenants', session.tenantId || 'default', 'tables', 'notifications'), (docSnap) => {
              if (docSnap.exists()) {
                setNotifications(docSnap.data().data || []);
              } else {
                setNotifications([]);
              }
            }, (err) => {
              console.warn('Firestore notifications listener failed, falling back to polling:', err);
              startPolling();
            });
          } else {
            startPolling();
          }
        } catch (err) {
          console.warn('Failed to setup Firebase real-time notifications, falling back to polling:', err);
          startPolling();
        }
      };

      const startPolling = () => {
        loadNotifications();
        pollingTimer = setInterval(loadNotifications, 8000);
      };

      setupRealtimeNotifications();

      return () => {
        if (unsubscribe) unsubscribe();
        if (pollingTimer) clearInterval(pollingTimer);
      };
    }
  }, [session]);

  const [currentUserName, setCurrentUserName] = useState('');

  useEffect(() => {
    if (session) {
      setCurrentUserName(session.name || session.username);
    } else {
      setCurrentUserName('');
    }
  }, [session]);

  // Real-time synchronization of logged-in user's name
  useEffect(() => {
    if (session && session.role !== 'superadmin') {
      let unsubscribe = null;
      let pollingTimer = null;

      const syncUserName = (usersList) => {
        const currentUser = usersList.find(u => u.id === session.id);
        if (currentUser && currentUser.name) {
          setCurrentUserName(currentUser.name);
        }
      };

      const setupRealtimeUsers = async () => {
        try {
          const { db, isFirebaseConfigured } = await import('./firebase');
          const { doc, onSnapshot } = await import('firebase/firestore');

          if (isFirebaseConfigured && db) {
            unsubscribe = onSnapshot(doc(db, 'tenants', session.tenantId || 'default', 'tables', 'users'), (docSnap) => {
              if (docSnap.exists()) {
                syncUserName(docSnap.data().data || []);
              }
            }, (err) => {
              console.warn('Firestore users listener failed, falling back to polling:', err);
              startPolling();
            });
          } else {
            startPolling();
          }
        } catch (err) {
          console.warn('Failed to setup Firebase real-time users, falling back to polling:', err);
          startPolling();
        }
      };

      const startPolling = () => {
        const poll = async () => {
          try {
            const usersList = await api.getUsers();
            syncUserName(usersList);
          } catch (err) {
            console.error('Error polling users', err);
          }
        };
        poll();
        pollingTimer = setInterval(poll, 8000);
      };

      setupRealtimeUsers();

      return () => {
        if (unsubscribe) unsubscribe();
        if (pollingTimer) clearInterval(pollingTimer);
      };
    }
  }, [session]);

  const loadNotifications = async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data);
    } catch (err) {
      console.error('Error fetching notifications', err);
    }
  };

  const markAllRead = async () => {
    try {
      await api.markNotificationsRead();
      setNotifications(notifications.map(n => ({ ...n, status: 'read' })));
    } catch (err) {
      console.error(err);
    }
  };

  // Translation helper
  const t = (key) => {
    return translations[lang][key] || key;
  };

  const handleLogout = () => {
    setSession(null);
    setActiveTab('dashboard');
    setSelectedOrderId(null);
  };

  if (!session) {
    return (
      <Login
        setSession={setSession}
        t={t}
        theme={theme}
        setTheme={setTheme}
        lang={lang}
        setLang={setLang}
      />
    );
  }

  // Sidebar link details
  const getSidebarLinks = () => {
    const role = session.role;
    const links = [{ id: 'dashboard', label: t('dashboard'), icon: '📊' }];

    if (role === 'superadmin') {
      return [{ id: 'dashboard', label: 'Super Admin', icon: '👑' }];
    }

    if (role === 'admin') {
      links.push(
        { id: 'routes', label: t('route_mgmt'), icon: '🗺️' },
        { id: 'shops', label: t('shop_mgmt'), icon: '🏢' },
        { id: 'products', label: t('product_mgmt'), icon: '🥤' },
        { id: 'purchases', label: t('purchase_entry'), icon: '📥' },
        { id: 'stock', label: t('stock_ledger'), icon: '📈' },
        { id: 'orders', label: t('order_taking'), icon: '🛒' },
        { id: 'deliveries', label: t('deliveries'), icon: '🚚' },
        { id: 'vehicle_sales', label: t('vehicle_direct_sales'), icon: '🚛' },
        { id: 'reports', label: t('reports'), icon: '📈' },
        { id: 'users', label: t('staff_mgmt'), icon: '👥' },
        { id: 'recycle_bin', label: t('recycle_bin'), icon: '♻️' }
      );
    } else if (role === 'salesman') {
      links.push(
        { id: 'shops', label: t('shop_mgmt'), icon: '🏢' },
        { id: 'orders', label: t('order_taking'), icon: '🛒' },
        { id: 'vehicle_sales', label: t('vehicle_direct_sales'), icon: '🚛' },
        { id: 'stock', label: t('stock_ledger'), icon: '📈' }
      );
    } else if (role === 'delivery') {
      links.push(
        { id: 'deliveries', label: t('deliveries'), icon: '🚚' }
      );
    }

    return links;
  };

  // Handle invoice display redirection
  const handleOrderCreated = (orderId) => {
    setSelectedOrderId(orderId);
    setActiveTab('billing');
  };

  const handleViewBillFromDelivery = (orderId) => {
    setSelectedOrderId(orderId);
    setActiveTab('billing');
  };

  // Content switching switcher
  const renderContent = () => {
    if (activeTab === 'billing' && selectedOrderId) {
      return (
        <Billing
          orderId={selectedOrderId}
          t={t}
          lang={lang}
          onBack={() => {
            setSelectedOrderId(null);
            setActiveTab(session.role === 'delivery' ? 'deliveries' : 'dashboard');
          }}
        />
      );
    }

    switch (activeTab) {
      case 'dashboard':
        if (session.role === 'superadmin') return <SuperAdminDashboard t={t} lang={lang} />;
        return <Dashboard t={t} lang={lang} />;
      case 'routes':
        return <RouteMgr t={t} lang={lang} />;
      case 'shops':
        return <ShopMgr t={t} lang={lang} onBillSelected={handleViewBillFromDelivery} />;
      case 'products':
        return <ProductMgr t={t} lang={lang} />;
      case 'purchases':
        return <PurchaseMgr t={t} lang={lang} />;
      case 'stock':
        return <StockMgr t={t} lang={lang} />;
      case 'orders':
        return <OrderTaking t={t} lang={lang} onOrderCreated={handleOrderCreated} />;
      case 'deliveries':
        return <DeliveryMgr t={t} lang={lang} onBillSelected={handleViewBillFromDelivery} />;
      case 'reports':
        return <Reports t={t} lang={lang} onBillSelected={handleViewBillFromDelivery} session={session} />;
      case 'users':
        return <UserMgr t={t} lang={lang} />;
      case 'recycle_bin':
        return <RecycleBin t={t} lang={lang} />;
      case 'vehicle_sales':
        return <VehicleDirectSales t={t} lang={lang} onBillSelected={handleViewBillFromDelivery} />;
      default:
        return <Dashboard t={t} lang={lang} />;
    }
  };

  const unreadNotifications = notifications.filter(n => n.status === 'unread');

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <header className="navbar no-print">
        <div className="brand">
          <button className="menu-toggle-btn" onClick={() => setMenuHidden(!menuHidden)} title="Toggle Menu">
            ☰
          </button>
          <span>{t('title')}</span>
        </div>

        <div className="nav-controls">
          {/* Theme Toggle */}
          <button className="theme-toggle-btn" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} title="Toggle theme">
            {theme === 'light' ? '🌙' : '☀️'}
          </button>

          {/* Instant Translation Switch */}
          <button className="language-btn" onClick={() => setLang(lang === 'en' ? 'ta' : 'en')}>
            🌐 {t('switch_language')}
          </button>

          {/* User Badge */}
          <div className={`role-badge ${session.role}`}>
            {currentUserName || session.name} ({t(session.role)})
          </div>

          {/* Notification bell */}
          <div className="notification-bell" onClick={() => setShowNotifications(!showNotifications)}>
            🔔
            {unreadNotifications.length > 0 && (
              <span className="badge-count">{unreadNotifications.length}</span>
            )}
          </div>

          {/* Notifications List Popup */}
          {showNotifications && (
            <div className="notifications-popup">
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
                <strong style={{ fontSize: '0.9rem' }}>{t('notifications')}</strong>
                {unreadNotifications.length > 0 && (
                  <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold' }}>
                    {t('mark_all_read')}
                  </button>
                )}
              </div>
              <div>
                {notifications.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>{t('no_notifications')}</p>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} className={`notification-item ${n.type}`}>
                      <div>{lang === 'ta' ? n.message_ta : n.message_en}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        {new Date(n.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Logout */}
          <button className="logout-btn" onClick={handleLogout}>
            🚪 {t('logout')}
          </button>
        </div>
      </header>

      {/* Main Area */}
      <div className="workspace">
        {/* Sidebar */}
        <aside className={`sidebar no-print ${menuHidden ? 'hidden' : ''}`}>
          {getSidebarLinks().map(link => (
            <button
              key={link.id}
              onClick={() => {
                setActiveTab(link.id);
                setSelectedOrderId(null);
                if (window.innerWidth <= 768) {
                  setMenuHidden(true);
                }
              }}
              className={`sidebar-link ${activeTab === link.id ? 'active' : ''}`}
            >
              <span>{link.icon}</span>
              <span>{link.label}</span>
            </button>
          ))}
        </aside>

        {/* Dynamic Panels */}
        <main className="main-content">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
