import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api.js';

export default function Balances() {
  const [balances, setBalances] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [groupId, setGroupId] = useState('');
  
  // Explainability drawer states
  const [explanationUser, setExplanationUser] = useState(null);
  const [explanationData, setExplanationData] = useState(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    const cachedGroupId = localStorage.getItem('activeGroupId');
    if (cachedGroupId) {
      setGroupId(cachedGroupId);
      fetchBalancesAndSettlements(cachedGroupId);
    } else {
      setError('Please select a group on the Dashboard first.');
    }
  }, [navigate]);

  const fetchBalancesAndSettlements = async (gId) => {
    try {
      setLoading(true);
      const data = await api.getBalances(gId);
      setBalances(data.balances);
      setSettlements(data.optimizedSettlements);
    } catch (err) {
      setError('Failed to fetch balances.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenExplanation = async (user) => {
    setExplanationUser(user);
    setLoadingExplanation(true);
    setExplanationData(null);
    try {
      const explanation = await api.getExplanation(groupId, user.userId);
      setExplanationData(explanation);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch balance explanation.');
    } finally {
      setLoadingExplanation(false);
    }
  };

  const handleCloseExplanation = () => {
    setExplanationUser(null);
    setExplanationData(null);
  };

  const handleRecordSettlement = async (settlement) => {
    const confirmSettle = window.confirm(`Log payment of ₹${settlement.amount.toFixed(2)} from ${settlement.fromUserName} to ${settlement.toUserName}?`);
    if (!confirmSettle) return;

    try {
      await api.recordSettlement(groupId, {
        fromUserId: settlement.fromUserId,
        toUserId: settlement.toUserId,
        amount: settlement.amount,
        currency: 'INR',
        paymentDate: new Date()
      });
      setMessage(`Settlement payment of ₹${settlement.amount.toFixed(2)} logged successfully!`);
      // Refresh balances
      fetchBalancesAndSettlements(groupId);
    } catch (err) {
      setError(err.message || 'Failed to log settlement payment.');
    }
  };

  return (
    <div className="main-content">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Balances & Settlements</h1>
          <p className="page-description">Optimize group netting settlements and check individual audit trails.</p>
        </div>
      </div>

      {error && (
        <div className="badge badge-error" style={{ display: 'block', padding: '12px', borderRadius: '8px', marginBottom: '20px', textTransform: 'none', width: '100%' }}>
          ⚠️ {error}
        </div>
      )}

      {message && (
        <div className="badge badge-success" style={{ display: 'block', padding: '12px', borderRadius: '8px', marginBottom: '20px', textTransform: 'none', width: '100%' }}>
          ✅ {message}
        </div>
      )}

      <div className="dashboard-grid">
        {/* Left Column: Member Net Balances */}
        <div>
          <div className="card" style={{ padding: '24px' }}>
            <div className="card-header" style={{ marginBottom: '16px' }}>
              <h2>Balances Sheet</h2>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Click member to review audit log</span>
            </div>

            {loading ? (
              <div className="empty-state"><h3>Calculating group balances...</h3></div>
            ) : balances.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {balances.map(b => (
                  <div key={b.userId} className="balance-card" onClick={() => handleOpenExplanation(b)}>
                    <div>
                      <span className="balance-user" style={{ color: 'var(--text-primary)' }}>{b.name}</span>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Paid out: ₹{b.totalPaid.toFixed(2)} | Share: ₹{b.totalOwed.toFixed(2)}
                      </div>
                    </div>
                    
                    <span className={`balance-amount ${b.netBalance >= 0 ? 'balance-positive' : 'balance-negative'}`} style={{ fontWeight: '700', fontSize: '15px' }}>
                      {b.netBalance >= 0 ? '+' : ''}₹{b.netBalance.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">No members found.</div>
            )}
          </div>
        </div>

        {/* Right Column: Optimized Settlements (Aisha) */}
        <div>
          <div className="card" style={{ padding: '24px' }}>
            <div className="card-header" style={{ marginBottom: '16px' }}>
              <h2>Optimized Settlements (Aisha)</h2>
            </div>
            
            {loading ? (
              <div className="empty-state"><h3>Calculating graph netting...</h3></div>
            ) : settlements.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {settlements.map((s, idx) => (
                  <div key={idx} className="settlement-card" style={{ background: '#ffffff', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div className="settlement-details" style={{ fontSize: '13px' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>{s.fromUserName}</strong>
                        <span className="settlement-arrow" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>➔ Pay </span>
                        <strong style={{ color: 'var(--text-primary)' }}>{s.toUserName}</strong>
                      </div>
                      <div style={{ color: 'var(--primary)', fontWeight: '700', fontSize: '16px', marginTop: '2px' }}>
                        ₹{s.amount.toFixed(2)}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleRecordSettlement(s)}
                      className="btn btn-primary"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      Settle
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '24px', color: 'var(--success)' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎉</div>
                <h4 style={{ color: 'var(--success)', fontWeight: '600' }}>Group is Settled</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>No payments are pending.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Slide-out Explainability Drawer (Rohan Requirement) */}
      {explanationUser && (
        <div className="drawer-backdrop" onClick={handleCloseExplanation}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div className="drawer-title">Audit Explanation: {explanationUser.name}</div>
              <button className="drawer-close" onClick={handleCloseExplanation}>&times;</button>
            </div>
            
            <div className="drawer-content">
              {loadingExplanation ? (
                <div className="empty-state"><h3>Analyzing audit trails...</h3></div>
              ) : explanationData ? (
                <div>
                  {/* Aggregation Summary */}
                  <div className="card" style={{ background: '#f8fafc', border: '1px solid var(--border-color)', boxShadow: 'none', padding: '20px' }}>
                    <h3 style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: '700', letterSpacing: '0.05em' }}>
                      Ledger Net Equation
                    </h3>
                    <div style={{ fontSize: '26px', fontWeight: '800', color: explanationData.summary.netBalance >= 0 ? 'var(--success)' : 'var(--error)' }}>
                      {explanationData.summary.netBalance >= 0 ? '+' : '-'}₹{Math.abs(explanationData.summary.netBalance).toFixed(2)}
                    </div>
                    <div className="explain-formula">
                      {explanationData.explanationText}
                    </div>
                  </div>

                  {/* Group Memberships timeline reference */}
                  <div className="explain-section">
                    <h3>Group Member Status</h3>
                    {explanationData.membershipHistory.map((m, idx) => (
                      <div key={idx} style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        ▪️ Member active from {new Date(m.joinedAt).toLocaleDateString(undefined, { timeZone: 'UTC' })}
                        {m.leftAt ? ` to ${new Date(m.leftAt).toLocaleDateString(undefined, { timeZone: 'UTC' })}` : ' onwards'}
                      </div>
                    ))}
                  </div>

                  {/* Paid Expenses list */}
                  <div className="explain-section">
                    <h3>1. Expenses Paid (Credits)</h3>
                    {explanationData.breakdown.paidExpenses.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {explanationData.breakdown.paidExpenses.map(item => (
                          <div key={item.expenseId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                            <div>
                              <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{item.title}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                {new Date(item.date).toLocaleDateString(undefined, { timeZone: 'UTC' })} | Split: {item.splitType}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ color: 'var(--success)', fontWeight: '600' }}>+₹{item.creditInr.toFixed(2)}</div>
                              {item.currency !== 'INR' && (
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                  {item.originalAmount.toFixed(2)} {item.currency} @ {item.exchangeRate.toFixed(4)}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No expenses paid.</div>
                    )}
                  </div>

                  {/* Participated Shares list */}
                  <div className="explain-section">
                    <h3>2. Split Shares (Debits)</h3>
                    {explanationData.breakdown.participatedExpenses.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {explanationData.breakdown.participatedExpenses.map(item => (
                          <div key={item.expenseId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                            <div>
                              <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{item.title}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                Paid by {item.paidBy} on {new Date(item.date).toLocaleDateString(undefined, { timeZone: 'UTC' })}
                                {item.rawSplitValue !== null && ` | Factor: ${item.rawSplitValue}`}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ color: 'var(--error)', fontWeight: '600' }}>-₹{item.shareAmountInr.toFixed(2)}</div>
                              {item.currency !== 'INR' && (
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                  {item.shareAmount.toFixed(2)} {item.currency} @ {item.exchangeRate.toFixed(4)}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No splits assigned.</div>
                    )}
                  </div>

                  {/* Settlements Sent */}
                  <div className="explain-section">
                    <h3>3. Settlements Sent (Credits)</h3>
                    {explanationData.breakdown.sentPayments.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {explanationData.breakdown.sentPayments.map(item => (
                          <div key={item.paymentId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                            <div>
                              <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>Paid to {item.toUser}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                {new Date(item.date).toLocaleDateString(undefined, { timeZone: 'UTC' })}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', color: 'var(--success)', fontWeight: '600' }}>
                              +₹{item.creditInr.toFixed(2)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No payments sent.</div>
                    )}
                  </div>

                  {/* Settlements Received */}
                  <div className="explain-section">
                    <h3>4. Settlements Received (Debits)</h3>
                    {explanationData.breakdown.receivedPayments.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {explanationData.breakdown.receivedPayments.map(item => (
                          <div key={item.paymentId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                            <div>
                              <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>Received from {item.fromUser}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                {new Date(item.date).toLocaleDateString(undefined, { timeZone: 'UTC' })}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', color: 'var(--error)', fontWeight: '600' }}>
                              -₹{item.debitInr.toFixed(2)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No payments received.</div>
                    )}
                  </div>

                </div>
              ) : (
                <div>No explanation loaded.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
