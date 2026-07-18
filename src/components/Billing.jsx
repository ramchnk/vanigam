import React, { useState, useEffect } from 'react';
import api from '../api';

export default function Billing({ orderId, t, lang, onBack }) {
  const [order, setOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [shop, setShop] = useState(null);
  const [route, setRoute] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInvoiceData() {
      if (!orderId) return;
      try {
        const [ordData, itemData, prodData, shopData, routeData, payData] = await Promise.all([
          api.getOrders(),
          api.getOrderItems(),
          api.getProducts(),
          api.getShops(),
          api.getRoutes(),
          api.getPayments()
        ]);

        const currentOrder = ordData.find(o => o.id === orderId);
        if (currentOrder) {
          setOrder(currentOrder);
          
          const items = itemData.filter(oi => oi.order_id === orderId);
          setOrderItems(items);

          const currentShop = shopData.find(s => s.id === currentOrder.shop_id);
          setShop(currentShop);

          const currentRoute = routeData.find(r => r.id === currentOrder.route_id);
          setRoute(currentRoute);

          // Find payment for this order
          const paymentList = payData.filter(p => p.order_id === orderId);
          setPayments(paymentList);
        }
        setProducts(prodData);
      } catch (err) {
        console.error('Failed to load invoice details', err);
      } finally {
        setLoading(false);
      }
    }
    loadInvoiceData();
  }, [orderId]);

  if (loading) return <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Loading Invoice...</div>;
  if (!order) return <div style={{ color: 'var(--danger)', textAlign: 'center' }}>Invoice not found</div>;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    alert('Simulating PDF Download. Invoice has been saved as ' + order.invoice_number + '.pdf');
  };

  // Compile WhatsApp text
  const getWhatsAppLink = () => {
    if (!shop) return '#';
    const shopName = lang === 'ta' ? shop.name_ta : shop.name_en;
    const collected = payments.reduce((sum, p) => sum + p.collected_amount, 0);
    const balance = shop.outstanding_amount;
    const itemsStr = orderItems.map(item => {
      const p = products.find(prod => prod.id === item.product_id);
      const name = p ? (lang === 'ta' ? p.name_ta : p.name_en) : '';
      return `${name} (${item.cases}C, ${item.bottles}B)`;
    }).join(', ');

    const message = `*${t('company_name')}*\n` +
      `Invoice No: ${order.invoice_number}\n` +
      `Date: ${new Date(order.order_date).toLocaleDateString()}\n` +
      `Shop: ${shopName}\n` +
      `Items: ${itemsStr}\n` +
      `Net Total: ₹${order.net_amount}\n` +
      `Collected Payment: ₹${collected}\n` +
      `Outstanding Balance: ₹${balance}\n` +
      `Thank you for your business!`;

    return `https://api.whatsapp.com/send?phone=${shop.mobile}&text=${encodeURIComponent(message)}`;
  };

  const totalCollected = payments.reduce((sum, p) => sum + p.collected_amount, 0);
  const outstandingBeforeOrder = shop ? shop.outstanding_amount + totalCollected - order.net_amount : 0;
  const remainingOutstanding = shop ? shop.outstanding_amount : 0;

  return (
    <div>
      <div style={{ marginBottom: '2rem' }} className="no-print">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>📄 {t('invoice')}</h1>
            <p style={{ color: 'var(--text-muted)' }}>Preview, print receipt, download PDF, or share via WhatsApp</p>
          </div>
          <button className="btn btn-secondary" onClick={onBack}>
            ⬅ Back
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
        
        {/* Printable Invoice Container */}
        <div className="invoice-card">
          <div className="invoice-header">
            <h2>{t('company_name')}</h2>
            <p style={{ fontSize: '9px', color: '#64748b' }}>{t('company_address')}</p>
            <p style={{ fontSize: '9px', fontWeight: 'bold' }}>{t('company_gst')}</p>
          </div>

          <div className="invoice-meta">
            <div>
              <p><strong>{t('invoice_number')}:</strong> {order.invoice_number}</p>
              <p><strong>Date:</strong> {new Date(order.order_date).toLocaleDateString()}</p>
              <p><strong>Route:</strong> {route ? (lang === 'ta' ? route.name_ta : route.name_en) : ''}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p><strong>Customer:</strong> {shop ? (lang === 'ta' ? shop.name_ta : shop.name_en) : ''}</p>
              <p>Contact: {shop ? shop.mobile : ''}</p>
              <p>GSTIN: {shop ? shop.gst_number || 'N/A' : ''}</p>
            </div>
          </div>

          <table className="invoice-table">
            <thead>
              <tr>
                <th>Items Details</th>
                <th style={{ textAlign: 'center' }}>Cases</th>
                <th style={{ textAlign: 'center' }}>Bottles</th>
                <th style={{ textAlign: 'right' }}>Rate/C</th>
                <th style={{ textAlign: 'right' }}>{t('amount')}</th>
              </tr>
            </thead>
            <tbody>
              {orderItems.map(item => {
                const prod = products.find(p => p.id === item.product_id);
                const pName = prod ? (lang === 'ta' ? prod.name_ta : prod.name_en) : '';
                const pSize = prod ? prod.size : '';

                return (
                  <tr key={item.id}>
                    <td>{pName} ({pSize})</td>
                    <td style={{ textAlign: 'center' }}>{item.cases || 0}</td>
                    <td style={{ textAlign: 'center' }}>{item.bottles || 0}</td>
                    <td style={{ textAlign: 'right' }}>₹{item.rate}</td>
                    <td style={{ textAlign: 'right' }}>₹{item.amount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Balance Computations */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #94a3b8', paddingTop: '10px' }}>
            <div style={{ width: '50%' }}>
              <p style={{ fontSize: '9px', color: '#64748b' }}>Outstanding Summary:</p>
              <p>Prev Outstanding: <strong>₹{outstandingBeforeOrder}</strong></p>
              <p>Amount Collected: <strong style={{ color: '#10b981' }}>₹{totalCollected}</strong></p>
              <p>Net Outstanding: <strong style={{ color: '#ef4444' }}>₹{remainingOutstanding}</strong></p>
            </div>
            
            <div style={{ width: '40%', textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal:</span>
                <span>₹{order.total_amount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Discount:</span>
                <span>-₹{order.discount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '12px', color: '#0f172a', borderTop: '1.5px solid #0f172a', paddingTop: '4px' }}>
                <span>{t('net_total')}:</span>
                <span>₹{order.net_amount}</span>
              </div>
            </div>
          </div>

          {/* GPay QR payment box in printed bill */}
          <div className="invoice-payment-qrcode">
            <span>{t('qr_payment_title')}</span>
            <svg viewBox="0 0 100 100" style={{ width: '80px', height: '80px' }}>
              <rect width="100" height="100" fill="white" />
              <rect x="10" y="10" width="20" height="20" fill="black" />
              <rect x="15" y="15" width="10" height="10" fill="white" />
              <rect x="70" y="10" width="20" height="20" fill="black" />
              <rect x="75" y="15" width="10" height="10" fill="white" />
              <rect x="10" y="70" width="20" height="20" fill="black" />
              <rect x="15" y="75" width="10" height="10" fill="white" />
              <rect x="40" y="40" width="20" height="20" fill="black" />
              <path d="M 35 15 H 65 V 25 H 35 Z M 15 35 H 25 V 65 H 15 Z M 45 75 H 85 V 85 H 45 Z" fill="black" />
            </svg>
            <p style={{ fontSize: '8px', color: '#64748b' }}>Scan QR to complete direct settlement</p>
          </div>
        </div>

        {/* Buttons Controls */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }} className="no-print">
          <button className="btn btn-primary" onClick={handlePrint}>
            🖨️ {t('print_invoice')} (A4 Half Size)
          </button>
          
          <button className="btn btn-secondary" onClick={handleDownloadPDF}>
            📥 {t('download_pdf')}
          </button>

          <a className="btn btn-secondary" href={getWhatsAppLink()} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', background: '#128C7E', color: 'white', borderColor: '#128C7E' }}>
            💬 {t('share_whatsapp')}
          </a>
        </div>
      </div>
    </div>
  );
}
