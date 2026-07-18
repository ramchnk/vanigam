import React, { useState, useEffect } from 'react';
import { api } from '../api';
import './SuperAdminDashboard.css';

export default function SuperAdminDashboard({ t, lang }) {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTenantId, setNewTenantId] = useState('');
  const [newTenantName, setNewTenantName] = useState('');
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('123456');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const data = await api.getTenants();
      setTenants(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to fetch tenants');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTenant = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!newTenantId || !newTenantName) {
      setError('Company Code and Name are required');
      return;
    }

    try {
      await api.createTenant({ id: newTenantId, name: newTenantName, adminUsername, adminPassword });
      setSuccess('Tenant created successfully');
      setNewTenantId('');
      setNewTenantName('');
      setAdminUsername('admin');
      setAdminPassword('123456');
      fetchTenants();
    } catch (err) {
      setError(err.message || 'Failed to create tenant');
    }
  };

  const toggleStatus = async (tenantId, currentStatus) => {
    try {
      await api.updateTenantStatus(tenantId, !currentStatus);
      fetchTenants();
    } catch (err) {
      setError(err.message || 'Failed to update tenant status');
    }
  };

  const handleDeleteTenant = async (tenantId, tenantName) => {
    if (window.confirm(`Are you sure you want to permanently delete the tenant "${tenantName}" (${tenantId})? This action cannot be undone and will delete all associated data.`)) {
      try {
        await api.deleteTenant(tenantId);
        setSuccess(`Tenant ${tenantName} deleted successfully.`);
        fetchTenants();
      } catch (err) {
        setError(err.message || 'Failed to delete tenant');
      }
    }
  };

  return (
    <div className="superadmin-dashboard fade-in">
      <h2>Super Admin Dashboard - Tenant Management</h2>
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="tenant-creation-card glass-panel">
        <h3>Create New Company / Tenant</h3>
        <form onSubmit={handleCreateTenant} className="tenant-form">
          <div className="form-group">
            <label>Company Code (No spaces)</label>
            <input 
              type="text" 
              value={newTenantId} 
              onChange={e => setNewTenantId(e.target.value.replace(/\s/g, '').toUpperCase())} 
              placeholder="e.g. COMP_A"
              required 
            />
          </div>


          <div className="form-group">
            <label>Company Name</label>
            <input 
              type="text" 
              value={newTenantName} 
              onChange={e => setNewTenantName(e.target.value)} 
              placeholder="e.g. Company A Logistics"
              required 
            />
          </div>
          <div className="form-group">
            <label>Admin Username</label>
            <input 
              type="text" 
              value={adminUsername} 
              onChange={e => setAdminUsername(e.target.value)} 
              placeholder="admin"
              required 
            />
          </div>
          <div className="form-group">
            <label>Admin Password</label>
            <input 
              type="password" 
              value={adminPassword} 
              onChange={e => setAdminPassword(e.target.value)} 
              placeholder="123456"
              required 
            />
          </div>
          <button type="submit" className="primary-btn">Create Tenant</button>
        </form>
      </div>

      <div className="tenants-list-card glass-panel">
        <h3>Registered Tenants</h3>
        {loading ? (
          <p>Loading tenants...</p>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Company Code</th>
                  <th>Company Name</th>
                  <th>Created At</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map(tenant => (
                  <tr key={tenant.id} className={!tenant.active ? 'inactive-row' : ''}>
                    <td><strong>{tenant.id}</strong></td>
                    <td>{tenant.name}</td>
                    <td>{new Date(tenant.created_at).toLocaleString()}</td>
                    <td>
                      <span className={`status-badge ${tenant.active ? 'active' : 'inactive'}`}>
                        {tenant.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className={`action-btn ${tenant.active ? 'danger-btn' : 'success-btn'}`}
                        onClick={() => toggleStatus(tenant.id, tenant.active)}
                      >
                        {tenant.active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button 
                        className="action-btn danger-btn"
                        onClick={() => handleDeleteTenant(tenant.id, tenant.name)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {tenants.length === 0 && (
                  <tr>
                    <td colSpan="5" className="text-center">No tenants registered yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
