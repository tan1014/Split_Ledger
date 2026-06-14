import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api.js';

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [members, setMembers] = useState([]);
  const [groupId, setGroupId] = useState('');
  
  // Create expense form fields
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [paidById, setPaidById] = useState('');
  const [expenseDate, setExpenseDate] = useState('2026-06-15');
  const [splitType, setSplitType] = useState('EQUAL'); // EQUAL, EXACT, PERCENTAGE, SHARES

  // Split details mapping (userId -> input value for splits)
  const [splitValues, setSplitValues] = useState({});

  // Search, Filter, Sort, Pagination States
  const [searchText, setSearchText] = useState('');
  const [filterSplitType, setFilterSplitType] = useState('ALL');
  const [filterPayerId, setFilterPayerId] = useState('ALL');
  const [sortBy, setSortBy] = useState('date_desc'); // date_desc, date_asc, amount_desc, amount_asc
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

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
      fetchExpenses(cachedGroupId);
      fetchMembers(cachedGroupId);
    } else {
      setError('Please select a group on the Dashboard first.');
    }
  }, [navigate]);

  const fetchExpenses = async (gId) => {
    try {
      setLoading(true);
      const data = await api.getExpenses(gId);
      setExpenses(data);
    } catch (err) {
      setError('Failed to fetch expenses.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async (gId) => {
    try {
      const data = await api.getMembers(gId);
      setMembers(data);
      if (data.length > 0) {
        setPaidById(data[0].userId);
        
        // Initialize splits checkbox/values
        const initialVals = {};
        data.forEach(m => {
          initialVals[m.userId] = { selected: true, value: '' };
        });
        setSplitValues(initialVals);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filter members that were active on the selected expenseDate (Sam's requirement)
  const activeMembersOnDate = members.filter(m => {
    const date = new Date(expenseDate);
    const joined = new Date(m.joinedAt);
    const left = m.leftAt ? new Date(m.leftAt) : null;
    return date >= joined && (!left || date <= left);
  });

  const handleCheckboxChange = (userId) => {
    setSplitValues(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        selected: !prev[userId].selected
      }
    }));
  };

  const handleSplitValueChange = (userId, val) => {
    setSplitValues(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        value: val
      }
    }));
  };

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }

    // Gather participants list
    const participants = [];
    let sumVal = 0;

    for (const member of activeMembersOnDate) {
      const state = splitValues[member.userId];
      if (state && state.selected) {
        const value = state.value ? parseFloat(state.value) : null;
        if (splitType !== 'EQUAL' && (value === null || isNaN(value) || value < 0)) {
          setError(`Please specify a valid split value for ${member.user.name}`);
          return;
        }
        if (value !== null) {
          sumVal += value;
        }
        participants.push({
          userId: member.userId,
          value
        });
      }
    }

    if (participants.length === 0) {
      setError('Please select at least one active participant.');
      return;
    }

    // Split verification checks
    if (splitType === 'PERCENTAGE' && Math.abs(sumVal - 100) > 0.01) {
      setError(`Percentages sum must equal 100%. Currently it is ${sumVal}%.`);
      return;
    }
    if (splitType === 'EXACT' && Math.abs(sumVal - parsedAmount) > 0.05) {
      setError(`Exact splits sum must equal the total expense amount (₹${parsedAmount}). Currently it is ₹${sumVal}.`);
      return;
    }

    try {
      const expData = {
        title,
        amount: parsedAmount,
        currency,
        paidById,
        expenseDate: new Date(`${expenseDate}T00:00:00Z`),
        splitType,
        participants
      };

      await api.createExpense(groupId, expData);
      setMessage('Expense logged successfully!');
      setTitle('');
      setAmount('');
      
      // Reset splits input values
      const initialVals = {};
      members.forEach(m => {
        initialVals[m.userId] = { selected: true, value: '' };
      });
      setSplitValues(initialVals);

      fetchExpenses(groupId);
      setCurrentPage(1); // reset to page 1
    } catch (err) {
      setError(err.message || 'Failed to log expense.');
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm('Are you sure you want to delete this expense? This action will update ledger records.')) return;
    try {
      await api.deleteExpense(groupId, expenseId);
      setMessage('Expense deleted successfully.');
      fetchExpenses(groupId);
    } catch (err) {
      setError(err.message || 'Failed to delete expense.');
    }
  };

  // --- Search, Filter & Sort Processing ---
  const processedExpenses = expenses
    .filter(exp => {
      // 1. Search text filter
      if (!searchText) return true;
      return exp.title.toLowerCase().includes(searchText.toLowerCase());
    })
    .filter(exp => {
      // 2. Split type filter
      if (filterSplitType === 'ALL') return true;
      return exp.splitType === filterSplitType;
    })
    .filter(exp => {
      // 3. Payer filter
      if (filterPayerId === 'ALL') return true;
      return exp.paidById === filterPayerId;
    })
    .sort((a, b) => {
      // 4. Sorting logic
      if (sortBy === 'date_desc') {
        return new Date(b.expenseDate) - new Date(a.expenseDate);
      } else if (sortBy === 'date_asc') {
        return new Date(a.expenseDate) - new Date(b.expenseDate);
      } else if (sortBy === 'amount_desc') {
        return Number(b.amountInr) - Number(a.amountInr);
      } else if (sortBy === 'amount_asc') {
        return Number(a.amountInr) - Number(b.amountInr);
      }
      return 0;
    });

  // --- Client Side Pagination Calculations ---
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = processedExpenses.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(processedExpenses.length / itemsPerPage);

  return (
    <div className="main-content">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Expenses Ledger</h1>
          <p className="page-description">View, search, filter, and create shared bill transactions.</p>
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
        {/* Left Column: Expense Table */}
        <div>
          <div className="card" style={{ padding: '24px' }}>
            <div className="card-header" style={{ marginBottom: '16px' }}>
              <h2>Transactions Ledger</h2>
              <span className="badge badge-info">{processedExpenses.length} Matches</span>
            </div>

            {/* Table Filters Controls */}
            <div className="table-controls">
              <div className="search-input-wrapper">
                <input
                  type="text"
                  className="form-input"
                  placeholder="🔍 Search title..."
                  value={searchText}
                  onChange={(e) => {
                    setSearchText(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{ width: '100%', padding: '8px 12px' }}
                />
              </div>

              <select
                className="filter-select"
                value={filterSplitType}
                onChange={(e) => {
                  setFilterSplitType(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="ALL">All Split Methods</option>
                <option value="EQUAL">Equal Splits</option>
                <option value="PERCENTAGE">Percentage Splits</option>
                <option value="EXACT">Exact Splits</option>
                <option value="SHARES">Shares Splits</option>
              </select>

              <select
                className="filter-select"
                value={filterPayerId}
                onChange={(e) => {
                  setFilterPayerId(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="ALL">All Payers</option>
                {members.map(m => (
                  <option key={m.userId} value={m.userId}>{m.user.name}</option>
                ))}
              </select>

              <select
                className="filter-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="date_desc">Latest Date First</option>
                <option value="date_asc">Oldest Date First</option>
                <option value="amount_desc">Highest Amount First</option>
                <option value="amount_asc">Lowest Amount First</option>
              </select>
            </div>

            {loading ? (
              <div className="empty-state"><h3>Querying transactions ledger...</h3></div>
            ) : currentItems.length > 0 ? (
              <div className="table-container">
                <table className="saas-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Date</th>
                      <th>Paid By</th>
                      <th>Amount</th>
                      <th>Split Type</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentItems.map(exp => {
                      const dateStr = new Date(exp.expenseDate).toLocaleDateString(undefined, { timeZone: 'UTC' });
                      return (
                        <tr key={exp.id}>
                          <td style={{ fontWeight: '500' }}>{exp.title}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{dateStr}</td>
                          <td style={{ fontWeight: '500' }}>{exp.payer.name}</td>
                          <td>
                            <div style={{ fontWeight: '600' }}>
                              {exp.currency === 'INR' ? '₹' : `${exp.currency} `}
                              {Number(exp.amount).toFixed(2)}
                            </div>
                            {exp.currency !== 'INR' && (
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                ₹{Number(exp.amountInr).toFixed(2)}
                              </div>
                            )}
                          </td>
                          <td>
                            <span className="badge badge-info" style={{ textTransform: 'uppercase', fontSize: '10px' }}>
                              {exp.splitType}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500' }}>
                              {exp.participants.length} splits
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              onClick={() => handleDeleteExpense(exp.id)}
                              className="btn btn-secondary"
                              style={{ padding: '4px 10px', fontSize: '12px', color: 'var(--error)', borderColor: 'var(--border-color)', boxShadow: 'none' }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Pagination Controls Footer */}
                {totalPages > 1 && (
                  <div className="pagination">
                    <span>
                      Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({processedExpenses.length} total)
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-state">
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔍</div>
                <h3>No Transactions Found</h3>
                <p>Try clearing your active filters or log a new bill on the right.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Log New Expense Form */}
        <div>
          <div className="card" style={{ padding: '24px' }}>
            <div className="card-header">
              <h2>Log New Expense</h2>
            </div>
            
            <form onSubmit={handleCreateExpense}>
              <div className="form-group">
                <label htmlFor="expenses-title-input">Title / Description</label>
                <input
                  id="expenses-title-input"
                  type="text"
                  className="form-input"
                  placeholder="Grocery bill, wifi, electricity..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div className="form-group" style={{ flex: 2, margin: 0 }}>
                  <label htmlFor="expenses-amount-input">Amount</label>
                  <input
                    id="expenses-amount-input"
                    type="number"
                    step="0.01"
                    className="form-input"
                    placeholder="1200.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
                
                <div className="form-group" style={{ flex: 1, margin: 0 }}>
                  <label htmlFor="expenses-currency-select">Currency</label>
                  <select
                    id="expenses-currency-select"
                    className="filter-select"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    style={{ padding: '10px 12px' }}
                  >
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div className="form-group" style={{ flex: 1, margin: 0 }}>
                  <label htmlFor="expenses-payer-select">Paid By</label>
                  <select
                    id="expenses-payer-select"
                    className="filter-select"
                    value={paidById}
                    onChange={(e) => setPaidById(e.target.value)}
                    style={{ padding: '10px 12px' }}
                    required
                  >
                    {members.map(m => (
                      <option key={m.userId} value={m.userId}>{m.user.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ flex: 1, margin: 0 }}>
                  <label htmlFor="expenses-date-input">Expense Date</label>
                  <input
                    id="expenses-date-input"
                    type="date"
                    className="form-input"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="expenses-splittype-select">Split Method</label>
                <select
                  id="expenses-splittype-select"
                  className="filter-select"
                  value={splitType}
                  onChange={(e) => {
                    setSplitType(e.target.value);
                    // Reset inputs
                    const reset = {};
                    members.forEach(m => {
                      reset[m.userId] = { selected: true, value: '' };
                    });
                    setSplitValues(reset);
                  }}
                  style={{ padding: '10px 12px' }}
                >
                  <option value="EQUAL">Split Equally</option>
                  <option value="PERCENTAGE">Split by Percentages (%)</option>
                  <option value="EXACT">Split by Exact Amounts</option>
                  <option value="SHARES">Split by Shares</option>
                </select>
              </div>

              {/* Dynamic Participants list */}
              <div style={{ margin: '20px 0', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '12px', fontWeight: '600', letterSpacing: '0.05em' }}>
                  Split Participants ({activeMembersOnDate.length} Active)
                </h4>
                
                {activeMembersOnDate.length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--error)', fontWeight: '500' }}>
                    No group members were active on the selected date.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {activeMembersOnDate.map(member => {
                      const userState = splitValues[member.userId] || { selected: true, value: '' };
                      return (
                        <div key={member.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>
                            <input
                              type="checkbox"
                              checked={userState.selected}
                              onChange={() => handleCheckboxChange(member.userId)}
                              style={{ width: '15px', height: '15px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                            />
                            {member.user.name}
                          </label>
                          
                          {userState.selected && splitType !== 'EQUAL' && (
                            <input
                              type="number"
                              step="any"
                              className="form-input"
                              placeholder={
                                splitType === 'PERCENTAGE' ? '%' : splitType === 'EXACT' ? 'Amount' : 'Shares'
                              }
                              value={userState.value}
                              onChange={(e) => handleSplitValueChange(member.userId, e.target.value)}
                              style={{ maxWidth: '90px', padding: '4px 8px', fontSize: '12px', boxShadow: 'none' }}
                              required
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '10px' }} disabled={activeMembersOnDate.length === 0}>
                Log Expense
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
