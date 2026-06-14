import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api.js';

export default function Settings() {
  const [profile, setProfile] = useState(null);
  const [exchangeRates, setExchangeRates] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    fetchSettingsData();
  }, [navigate]);

  const fetchSettingsData = async () => {
    try {
      setLoading(true);
      const user = await api.getMe();
      setProfile(user);
      
      const rates = await api.getExchangeRates();
      setExchangeRates(rates);

      const logs = await api.getAuditLogs();
      setAuditLogs(logs);
    } catch (err) {
      console.error(err);
      setError('Failed to load system settings and audit trails.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="main-content">
        <div className="empty-state">
          <h3>Retrieving configuration data...</h3>
          <p>Please wait while we query audit logs and exchange rates.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings & Compliance</h1>
          <p className="page-description">Inspect currency indexes, user profile records, and audit logs.</p>
        </div>
      </div>

      {error && (
        <div className="badge badge-error" style={{ display: 'block', padding: '12px', borderRadius: '8px', marginBottom: '20px', textTransform: 'none', width: '100%' }}>
          ⚠️ {error}
        </div>
      )}

      <div className="dashboard-grid">
        {/* Left Column: Audit Logs Timeline */}
        <div>
          <div className="card" style={{ padding: '24px' }}>
            <div className="card-header" style={{ marginBottom: '16px' }}>
              <h2>Security Audit Logs</h2>
              <span className="badge badge-info">{auditLogs.length} Entries</span>
            </div>

            {auditLogs.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '550px', overflowY: 'auto', paddingRight: '4px' }}>
                {auditLogs.map(log => {
                  const dateStr = new Date(log.createdAt).toLocaleString();
                  return (
                    <div key={log.id} style={{
                      background: 'transparent', borderBottom: '1px solid var(--border-color)',
                      padding: '14px 0', fontSize: '13px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', flexWrap: 'wrap', gap: '8px' }}>
                        <strong style={{ color: 'var(--primary)', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>
                          {log.action}
                        </strong>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{dateStr}</span>
                      </div>
                      
                      <div style={{ color: 'var(--text-primary)', marginBottom: '2px' }}>
                        Entity: <strong>{log.entityType}</strong> (ID: <code style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{log.entityId}</code>)
                      </div>
                      
                      <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                        Triggered by: <strong>{log.user ? log.user.name : 'System Importer'}</strong> {log.user && `(${log.user.email})`}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '24px' }}>
                No audit log records found.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: User Profile & Exchange Rates */}
        <div>
          {/* Profile Card */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: '16px' }}>
              <h2>User Profile</h2>
            </div>
            {profile && (
              <div style={{ fontSize: '13px' }}>
                <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Name</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{profile.name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Email</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{profile.email}</strong>
                </div>
              </div>
            )}
          </div>

          {/* Exchange Rates Card */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: '16px' }}>
              <h2>Exchange Rates (to INR)</h2>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {exchangeRates.map(r => (
                <div key={r.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'transparent', padding: '10px 0',
                  fontSize: '13px', borderBottom: '1px solid var(--border-color)'
                }}>
                  <strong style={{ color: 'var(--text-primary)' }}>1 {r.fromCurrency}</strong>
                  <span style={{ color: 'var(--text-secondary)' }}>➔</span>
                  <strong style={{ color: 'var(--success)' }}>₹{Number(r.rate).toFixed(2)}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
