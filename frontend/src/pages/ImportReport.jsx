import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api.js';

export default function ImportReport() {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [parsedRows, setParsedRows] = useState([]);
  const [groupId, setGroupId] = useState('');
  const [members, setMembers] = useState([]);

  // Store user decisions for anomalies: { [anomalyId]: { decision: 'APPROVE_FIX' | 'IGNORE' | 'SKIP' | 'EDIT', resolvedValue: any } }
  const [decisions, setDecisions] = useState({});

  // Form edit helper states (to resolve missing payer name/email to user ID or manual exchange rates)
  const [editValues, setEditValues] = useState({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importReport, setImportReport] = useState(null);
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
      fetchJobAndAnomalies();
      fetchMembers(cachedGroupId);
    } else {
      setError('Group configuration not found.');
    }
  }, [jobId, navigate]);

  const fetchJobAndAnomalies = async () => {
    try {
      setLoading(true);
      const data = await api.getImportJob(localStorage.getItem('activeGroupId'), jobId);
      setJob(data);
      setAnomalies(data.anomalies);

      // Restore parsed rows from localStorage
      const cachedRows = localStorage.getItem(`import_rows_${jobId}`);
      if (cachedRows) {
        setParsedRows(JSON.parse(cachedRows));
      }

      // Initialize default decisions: PENDING for errors, or recommended actions
      const initialDecisions = {};
      data.anomalies.forEach(anom => {
        // By default, recommend APPROVE_FIX for duplicate skip or settlement conversion
        initialDecisions[anom.id] = {
          decision: anom.severity === 'WARNING' ? 'APPROVE_FIX' : 'PENDING',
          resolvedValue: null
        };
      });
      setDecisions(initialDecisions);
    } catch (err) {
      setError('Failed to fetch import job anomalies.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async (gId) => {
    try {
      const data = await api.getMembers(gId);
      setMembers(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDecision = (anomalyId, decisionType, resolvedValue = null) => {
    setDecisions(prev => ({
      ...prev,
      [anomalyId]: {
        decision: decisionType,
        resolvedValue
      }
    }));
  };

  const handleEditPayerChange = (anomalyId, userId) => {
    setEditValues(prev => ({
      ...prev,
      [anomalyId]: { ...prev[anomalyId], payerId: userId }
    }));
    handleDecision(anomalyId, 'EDIT', { payerId: userId });
  };

  const handleEditRateChange = (anomalyId, rate) => {
    setEditValues(prev => ({
      ...prev,
      [anomalyId]: { ...prev[anomalyId], exchangeRate: rate }
    }));
    handleDecision(anomalyId, 'EDIT', { exchangeRate: rate });
  };

  const handleExecuteImport = async () => {
    setError('');
    
    // Check if any error is still PENDING
    const pendingAnoms = anomalies.filter(anom => {
      const state = decisions[anom.id];
      return state?.decision === 'PENDING' && anom.severity === 'ERROR';
    });

    if (pendingAnoms.length > 0) {
      setError(`Please resolve all ${pendingAnoms.length} blocking ERROR anomalies before executing import.`);
      return;
    }

    setLoading(true);
    try {
      const formattedDecisions = Object.entries(decisions).map(([anomalyId, val]) => ({
        anomalyId,
        decision: val.decision,
        resolvedValue: val.resolvedValue
      }));

      // Run Step 5: Import cleaned data
      const report = await api.resolveImport(groupId, jobId, formattedDecisions, parsedRows);
      setImportReport(report);
      
      // Clean up localStorage
      localStorage.removeItem(`import_rows_${jobId}`);
    } catch (err) {
      setError(err.message || 'Failed to execute import.');
    } finally {
      setLoading(false);
    }
  };

  // Compute live calculations for Dashboard summary
  const totalRows = parsedRows.length;
  const skippedRowsCount = Object.values(decisions).filter(d => d.decision === 'SKIP').length;
  const duplicateSkips = anomalies
    .filter(anom => anom.anomalyType === 'DUPLICATE_EXPENSE')
    .filter(anom => decisions[anom.id]?.decision === 'APPROVE_FIX').length;
  
  // A row is skipped if the user selects SKIP, or if it's a duplicate and user approves skipping
  const totalSkipped = skippedRowsCount + duplicateSkips;
  const totalImported = Math.max(0, totalRows - totalSkipped);
  
  const unresolvedCount = anomalies.filter(anom => {
    const state = decisions[anom.id];
    return state?.decision === 'PENDING' && anom.severity === 'ERROR';
  }).length;

  if (loading && !importReport) {
    return (
      <div className="main-content">
        <div className="empty-state">
          <h3>Analyzing ledger decisions...</h3>
          <p>This will commit all resolved transactions to the relational tables.</p>
        </div>
      </div>
    );
  }

  if (importReport) {
    return (
      <div className="main-content" style={{ maxWidth: '850px' }}>
        <div className="card" style={{ padding: '32px' }}>
          <div className="card-header" style={{ marginBottom: '20px' }}>
            <h2 style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ✓ CSV Import Completed Successfully
            </h2>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', margin: '24px 0' }}>
            <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500' }}>Rows Analyzed</div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '4px' }}>{importReport.rowsProcessed}</div>
            </div>
            <div style={{ background: 'var(--success-light)', border: '1px solid rgba(22, 163, 74, 0.15)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: 'var(--success)', fontWeight: '600' }}>Rows Imported</div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--success)', marginTop: '4px' }}>{importReport.rowsImported}</div>
            </div>
            <div style={{ background: 'var(--error-light)', border: '1px solid rgba(220, 38, 38, 0.15)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: 'var(--error)', fontWeight: '600' }}>Rows Skipped</div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--error)', marginTop: '4px' }}>{importReport.rowsSkipped}</div>
            </div>
          </div>

          <div style={{ marginTop: '24px' }}>
            <h3 style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '12px', fontWeight: '600' }}>Import Log (Trace Audits):</h3>
            <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '8px', maxHeight: '280px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.7' }}>
              {importReport.actionsTaken.map((action, idx) => (
                <div key={idx} style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '6px' }}>
                  • {action}
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '32px', display: 'flex', gap: '12px' }}>
            <button onClick={() => navigate('/')} className="btn btn-primary">Go to Dashboard</button>
            <button onClick={() => navigate('/balances')} className="btn btn-secondary">Check Net Balances</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content" style={{ maxWidth: '1000px' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Anomaly Scan Report</h1>
          <p className="page-description">Spreadsheet: <strong>{job?.fileName}</strong> | {parsedRows.length} total rows scan</p>
        </div>
        
        {/* SaaS style count cards */}
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ background: '#ffffff', border: '1px solid var(--border-color)', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Importing:</span>
            <strong style={{ color: 'var(--success)' }}>{totalImported}</strong>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid var(--border-color)', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Skipping:</span>
            <strong style={{ color: 'var(--error)' }}>{totalSkipped}</strong>
          </div>
          {unresolvedCount > 0 && (
            <div style={{ background: 'var(--warning-light)', border: '1px solid rgba(245, 158, 11, 0.15)', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: 'var(--warning)', fontWeight: '600' }}>Unresolved Errors:</span>
              <strong style={{ color: 'var(--warning)' }}>{unresolvedCount}</strong>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="badge badge-error" style={{ display: 'block', padding: '12px', borderRadius: '8px', marginBottom: '20px', textTransform: 'none', width: '100%' }}>
          ⚠️ {error}
        </div>
      )}

      {anomalies.length > 0 ? (
        <div className="anomaly-list">
          {anomalies.map(anom => {
            const state = decisions[anom.id] || { decision: 'PENDING', resolvedValue: null };
            const editVal = editValues[anom.id] || {};
            const isError = anom.severity === 'ERROR';

            return (
              <div key={anom.id} className="anomaly-card" style={{
                borderColor: state.decision === 'PENDING' ? (isError ? 'var(--error)' : 'var(--warning)') : 'var(--border-color)',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div className="anomaly-meta-line">
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>
                    Row <strong>#{anom.rowNumber}</strong> | Scan flag: <strong style={{ color: 'var(--text-primary)' }}>{anom.anomalyType}</strong>
                  </span>
                  
                  <span className={`badge ${isError ? 'badge-error' : 'badge-warning'}`} style={{ fontSize: '11px', padding: '2px 8px' }}>
                    {anom.severity}
                  </span>
                </div>

                <div className="anomaly-description" style={{ fontSize: '14px', color: 'var(--text-primary)', marginTop: '4px' }}>
                  {anom.description}
                </div>

                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Action suggestion: <strong style={{ color: 'var(--primary)', fontWeight: '600' }}>{anom.recommendedAction}</strong>
                </div>

                {/* Resolution buttons */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    onClick={() => handleDecision(anom.id, 'APPROVE_FIX')}
                    className={`btn ${state.decision === 'APPROVE_FIX' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '6px 14px', fontSize: '12px' }}
                  >
                    {anom.anomalyType === 'DUPLICATE_EXPENSE' ? 'Skip duplicate' :
                     anom.anomalyType === 'SETTLEMENT_DISGUISED_AS_EXPENSE' ? 'Convert to settlement' :
                     anom.anomalyType === 'MEMBER_NOT_ACTIVE_ON_EXPENSE_DATE' ? 'Exclude member from split' :
                     anom.anomalyType === 'MISSING_PAYER' ? 'Map to default admin' : 'Approve suggested resolution'}
                  </button>

                  <button
                    onClick={() => handleDecision(anom.id, 'SKIP')}
                    className={`btn ${state.decision === 'SKIP' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '6px 14px', fontSize: '12px', background: state.decision === 'SKIP' ? 'var(--error)' : '' }}
                  >
                    Skip row
                  </button>

                  {!isError && (
                    <button
                      onClick={() => handleDecision(anom.id, 'IGNORE')}
                      className={`btn ${state.decision === 'IGNORE' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '6px 14px', fontSize: '12px', background: state.decision === 'IGNORE' ? 'var(--warning)' : '', borderColor: state.decision === 'IGNORE' ? 'var(--warning)' : 'var(--border-color)' }}
                    >
                      Ignore warning
                    </button>
                  )}

                  {/* Manual input form for edits */}
                  {anom.anomalyType === 'MISSING_PAYER' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Map to:</span>
                      <select
                        className="filter-select"
                        value={editVal.payerId || ''}
                        onChange={(e) => handleEditPayerChange(anom.id, e.target.value)}
                        style={{ padding: '4px 8px', fontSize: '12px', margin: 0 }}
                      >
                        <option value="">Select Member</option>
                        {members.map(m => (
                          <option key={m.userId} value={m.userId}>{m.user.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {anom.anomalyType === 'UNSUPPORTED_CURRENCY' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Exchange Rate:</span>
                      <input
                        type="number"
                        step="0.0001"
                        className="form-input"
                        placeholder="83.50"
                        value={editVal.exchangeRate || ''}
                        onChange={(e) => handleEditRateChange(anom.id, e.target.value)}
                        style={{ padding: '4px 8px', fontSize: '12px', margin: 0, maxWidth: '100px', boxShadow: 'none' }}
                        required
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card empty-state" style={{ padding: '48px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎉</div>
          <h3>Spreadsheet is Clean</h3>
          <p style={{ marginBottom: '24px' }}>No anomalies detected. You can safely import all rows as-is.</p>
        </div>
      )}

      {/* Action Footer */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', borderLeft: unresolvedCount > 0 ? '4px solid var(--error)' : '4px solid var(--success)' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          {unresolvedCount > 0 ? (
            <span style={{ color: 'var(--error)', fontWeight: '500' }}>
              ✗ Unresolved errors remaining. Please choose decisions for all red ERROR alerts.
            </span>
          ) : (
            <span style={{ color: 'var(--success)', fontWeight: '500' }}>
              ✓ All anomalies evaluated. Ready to sync database.
            </span>
          )}
        </span>
        
        <button
          onClick={handleExecuteImport}
          className="btn btn-primary"
          style={{ padding: '10px 20px' }}
          disabled={unresolvedCount > 0 || parsedRows.length === 0}
        >
          Sync Ledger Database
        </button>
      </div>
    </div>
  );
}
