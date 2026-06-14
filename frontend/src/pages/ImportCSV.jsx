import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api.js';

export default function ImportCSV() {
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState('');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    fetchGroupsAndCache();
  }, [navigate]);

  const fetchGroupsAndCache = async () => {
    try {
      setLoading(true);
      const data = await api.getGroups();
      setGroups(data);
      
      const cachedGroupId = localStorage.getItem('activeGroupId');
      if (cachedGroupId && data.some(g => g.id === cachedGroupId)) {
        setGroupId(cachedGroupId);
      } else if (data.length > 0) {
        setGroupId(data[0].id);
        localStorage.setItem('activeGroupId', data[0].id);
      } else {
        setError('You must create a group in the Groups page before importing files.');
      }
    } catch (err) {
      setError('Failed to retrieve user groups.');
    } finally {
      setLoading(false);
    }
  };

  const handleGroupChange = (e) => {
    const selectedId = e.target.value;
    setGroupId(selectedId);
    localStorage.setItem('activeGroupId', selectedId);
    setError('');
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setError('');
    setFileName(file.name);
    setLoading(true);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const csvText = evt.target.result;
      try {
        // Send raw text to Express API to process Step 1 (Upload) and Step 2 (Run Anomaly engine)
        const result = await api.uploadCSV(groupId, file.name, csvText);
        
        // Save parsed rows in localStorage for recovery across pages
        localStorage.setItem(`import_rows_${result.jobId}`, JSON.stringify(result.parsedRows));
        
        // Route to resolution report
        navigate(`/import/report/${result.jobId}`);
      } catch (err) {
        setError(err.message || 'Failed to upload and analyze CSV file.');
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setError('Failed to read CSV file content.');
      setLoading(false);
    };
    reader.readAsText(file);
  };

  return (
    <div className="main-content" style={{ maxWidth: '800px' }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '28px' }}>
        <div>
          <h1 className="page-title">CSV Statement Importer</h1>
          <p className="page-description">Bulk import offline bills from spreadsheet exports safely.</p>
        </div>
      </div>

      {error && (
        <div className="badge badge-error" style={{ display: 'block', padding: '12px', borderRadius: '8px', marginBottom: '20px', textTransform: 'none', width: '100%' }}>
          ⚠️ {error}
        </div>
      )}

      <div className="card" style={{ padding: '32px' }}>
        <div className="card-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h2>Spreadsheet Upload Wizard</h2>
          
          {groups.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>Import into:</span>
              <select
                className="filter-select"
                value={groupId}
                onChange={handleGroupChange}
                style={{ padding: '6px 12px', fontSize: '13px', fontWeight: '500' }}
              >
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {loading && !groupId ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ display: 'inline-block', width: '40px', height: '40px', border: '3px solid var(--border-color)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
            <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>Scanning CSV Statement...</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px' }}>
              We are parsing cells and validating fields against group membership records.
            </div>
          </div>
        ) : (
          <div>
            <label htmlFor="import-csv-file-selector" className="import-area" style={{ opacity: groupId ? 1 : 0.5, cursor: groupId ? 'pointer' : 'not-allowed' }}>
              <div style={{ fontSize: '42px', marginBottom: '12px', color: 'var(--text-secondary)' }}>📄</div>
              <h3 style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '4px', fontWeight: '600' }}>
                {fileName ? `File: ${fileName}` : 'Choose CSV spreadsheet'}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                {groupId ? 'Click to browse files. Max upload limit 10MB.' : 'Please create a group to enable upload.'}
              </p>
              {groupId && (
                <input
                  id="import-csv-file-selector"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              )}
            </label>

            <div style={{ marginTop: '28px', borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
              <h4 style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '8px', fontWeight: '600' }}>CSV Formatting Template</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: '1.4' }}>
                Columns must map to these headers:
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontFamily: 'monospace', fontSize: '11px' }}>
                {['title', 'amount', 'currency', 'paid_by', 'expense_date', 'split_type', 'participants'].map((h, i) => (
                  <span key={i} style={{ background: '#f1f5f9', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '3px 8px', borderRadius: '4px' }}>
                    {h}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
