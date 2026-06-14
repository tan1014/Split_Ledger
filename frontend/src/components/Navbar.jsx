import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const token = localStorage.getItem('token');
  const userJson = localStorage.getItem('user');
  const user = userJson ? JSON.parse(userJson) : null;

  if (!token) return null;

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('activeGroupId');
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path ? 'active' : '';

  return (
    <nav className="navbar">
      <Link to="/" className="nav-brand" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/logo.png" alt="Split Ledger Logo" style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover' }} />
          <span>Split Ledger</span>
        </Link>
      
      <div className="nav-links">
        <Link to="/" className={`nav-link ${isActive('/')}`}>Dashboard</Link>
        <Link to="/groups" className={`nav-link ${isActive('/groups')}`}>Groups</Link>
        <Link to="/expenses" className={`nav-link ${isActive('/expenses')}`}>Expenses</Link>
        <Link to="/balances" className={`nav-link ${isActive('/balances')}`}>Balances</Link>
        <Link to="/import" className={`nav-link ${isActive('/import')}`}>Import CSV</Link>
        <Link to="/settings" className={`nav-link ${isActive('/settings')}`}>Settings</Link>
        
        <span style={{ color: 'var(--text-muted)', fontSize: '14px', marginLeft: '12px' }}>
          Hi, <strong style={{ color: '#fff' }}>{user?.name}</strong>
        </span>
        <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px' }}>
          Logout
        </button>
      </div>
    </nav>
  );
}
