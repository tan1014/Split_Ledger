import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../utils/api.js';

export default function Dashboard() {
  const [groups, setGroups] = useState([]);
  const [activeGroupId, setActiveGroupId] = useState('');
  const [expenses, setExpenses] = useState([]);
  const [netBalance, setNetBalance] = useState(0);
  const [groupSpending, setGroupSpending] = useState(0);
  const [activeMembersCount, setActiveMembersCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    fetchGroups();
  }, [navigate]);

  useEffect(() => {
    if (activeGroupId) {
      localStorage.setItem('activeGroupId', activeGroupId);
      fetchGroupDetails(activeGroupId);
    }
  }, [activeGroupId]);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const data = await api.getGroups();
      setGroups(data);
      if (data.length > 0) {
        const cachedGroupId = localStorage.getItem('activeGroupId');
        const defaultGroupId = cachedGroupId && data.some(g => g.id === cachedGroupId)
          ? cachedGroupId
          : data[0].id;
        setActiveGroupId(defaultGroupId);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupDetails = async (groupId) => {
    try {
      // Get expenses
      const expenseData = await api.getExpenses(groupId);
      setExpenses(expenseData.slice(0, 5)); // show only top 5 recent

      // Calculate total group spending
      const spending = expenseData.reduce((sum, e) => sum + Number(e.amountInr), 0);
      setGroupSpending(spending);

      // Get members
      const members = await api.getMembers(groupId);
      const activeMembers = members.filter(m => !m.leftAt);
      setActiveMembersCount(activeMembers.length);

      // Get net balance
      const balanceData = await api.getBalances(groupId);
      const user = JSON.parse(localStorage.getItem('user'));
      const userBal = balanceData.balances.find(b => b.userId === user.id);
      setNetBalance(userBal ? userBal.netBalance : 0);
    } catch (err) {
      console.error(err);
    }
  };

  const youOwe = netBalance < 0 ? Math.abs(netBalance) : 0;
  const youAreOwed = netBalance > 0 ? netBalance : 0;

  if (loading) {
    return (
      <div className="main-content">
        <div className="empty-state">
          <h3>Loading dashboard details...</h3>
          <p>Please wait while we query the ledger state.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-description">Overview of your shared household and group expenses.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {groups.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <select
                id="dashboard-group-selector"
                className="filter-select"
                value={activeGroupId}
                onChange={(e) => setActiveGroupId(e.target.value)}
                style={{ padding: '10px 14px', minWidth: '180px', fontWeight: '500' }}
              >
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}
          <Link to="/expenses" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            ➕ Log Expense
          </Link>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="card empty-state">
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>👥</div>
          <h3>No Active Groups</h3>
          <p style={{ marginBottom: '24px' }}>Create your first group to start splitting bills with flatmates.</p>
          <Link to="/groups" className="btn btn-primary" style={{ textDecoration: 'none' }}>Create Group</Link>
        </div>
      ) : (
        <div>
          {/* SaaS Metrics Cards Row */}
          <div className="metrics-row">
            <div className="metric-card">
              <span className="metric-label">Total Expenses</span>
              <span className="metric-value">₹{groupSpending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Total group spend</span>
            </div>
            
            <div className="metric-card">
              <span className="metric-label">You Owe</span>
              <span className="metric-value" style={{ color: youOwe > 0 ? 'var(--error)' : 'var(--text-primary)' }}>
                ₹{youOwe.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Your pending debt</span>
            </div>

            <div className="metric-card">
              <span className="metric-label">You Are Owed</span>
              <span className="metric-value" style={{ color: youAreOwed > 0 ? 'var(--success)' : 'var(--text-primary)' }}>
                ₹{youAreOwed.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Your pending credit</span>
            </div>

            <div className="metric-card">
              <span className="metric-label">Net Balance</span>
              <span className={`metric-value ${netBalance >= 0 ? 'balance-positive' : 'balance-negative'}`}>
                {netBalance >= 0 ? '+' : '-'}₹{Math.abs(netBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Your total net balance</span>
            </div>

            <div className="metric-card">
              <span className="metric-label">Group Members</span>
              <span className="metric-value" style={{ color: 'var(--primary)' }}>{activeMembersCount}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Active flatmates</span>
            </div>
          </div>

          {/* Main Dashboard Grid */}
          <div className="dashboard-grid">
            {/* Left Content Column */}
            <div>
              <div className="card">
                <div className="card-header">
                  <h2>Recent Expenses</h2>
                  <Link to="/expenses" style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: '600', textDecoration: 'none' }}>
                    View Ledger
                  </Link>
                </div>

                {expenses.length > 0 ? (
                  <div className="expense-list">
                    {expenses.map(exp => (
                      <div key={exp.id} className="expense-item" style={{ background: 'transparent', borderBottom: '1px solid var(--border-color)', borderRadius: 0, padding: '12px 0' }}>
                        <div className="expense-info">
                          <span className="expense-title" style={{ color: 'var(--text-primary)' }}>{exp.title}</span>
                          <span className="expense-meta">
                            Paid by <strong>{exp.payer.name}</strong> on {new Date(exp.expenseDate).toLocaleDateString(undefined, { timeZone: 'UTC' })}
                          </span>
                        </div>
                        <div className="expense-amount-sec">
                          <span className="expense-val" style={{ color: 'var(--text-primary)', fontSize: '15px' }}>
                            {exp.currency === 'INR' ? '₹' : `${exp.currency} `}
                            {Number(exp.amount).toFixed(2)}
                          </span>
                          {exp.currency !== 'INR' && (
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                              ₹{Number(exp.amountInr).toFixed(2)}
                            </span>
                          )}
                          <span className="badge badge-info" style={{ fontSize: '10px', marginTop: '4px', textTransform: 'uppercase', alignSelf: 'flex-end', padding: '1px 6px' }}>
                            {exp.splitType}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '32px' }}>
                    No expenses logged. Tap "Log Expense" or import a CSV to populate.
                  </div>
                )}
              </div>
            </div>

            {/* Right Quick Panel Column */}
            <div>
              <div className="card">
                <div className="card-header">
                  <h2>Shortcuts</h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <Link to="/import" className="btn btn-secondary" style={{ width: '100%', textDecoration: 'none', justifyContent: 'flex-start' }}>
                    📥 Import CSV Statement
                  </Link>
                  <Link to="/balances" className="btn btn-secondary" style={{ width: '100%', textDecoration: 'none', justifyContent: 'flex-start' }}>
                    📊 Debt Settlements Netting
                  </Link>
                  <Link to="/groups" className="btn btn-secondary" style={{ width: '100%', textDecoration: 'none', justifyContent: 'flex-start' }}>
                    👥 Manage Member Timelines
                  </Link>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h2>Group Details</h2>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Active Group: <strong>{groups.find(g => g.id === activeGroupId)?.name}</strong>
                </p>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: '1.4' }}>
                  {groups.find(g => g.id === activeGroupId)?.description || 'No description added.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
