import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api.js';

export default function Groups() {
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [members, setMembers] = useState([]);
  
  // Group creation form
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  
  // Member add form
  const [memberEmail, setMemberEmail] = useState('');
  const [joinedAtDate, setJoinedAtDate] = useState('2026-01-01');

  // Member leave form / state
  const [leftAtDate, setLeftAtDate] = useState('2026-06-15');

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
    fetchGroups();
  }, [navigate]);

  useEffect(() => {
    if (selectedGroupId) {
      fetchMembers(selectedGroupId);
    }
  }, [selectedGroupId]);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const data = await api.getGroups();
      setGroups(data);
      if (data.length > 0) {
        const cachedId = localStorage.getItem('activeGroupId');
        setSelectedGroupId(cachedId && data.some(g => g.id === cachedId) ? cachedId : data[0].id);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch groups.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async (groupId) => {
    try {
      const data = await api.getMembers(groupId);
      setMembers(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!newGroupName) return;

    try {
      const g = await api.createGroup(newGroupName, newGroupDesc);
      setMessage(`Group "${g.name}" created successfully!`);
      setNewGroupName('');
      setNewGroupDesc('');
      await fetchGroups();
      setSelectedGroupId(g.id);
    } catch (err) {
      setError(err.message || 'Failed to create group.');
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!memberEmail) return;

    try {
      const joinedDate = new Date(`${joinedAtDate}T00:00:00Z`);
      const m = await api.addMember(selectedGroupId, memberEmail, joinedDate);
      setMessage(`User ${m.user.name} added to the group successfully!`);
      setMemberEmail('');
      fetchMembers(selectedGroupId);
    } catch (err) {
      setError(err.message || 'Failed to add member.');
    }
  };

  const handleRemoveMember = async (userId, userName) => {
    setError('');
    setMessage('');
    
    const confirmLeave = window.confirm(`Are you sure you want to log leave for ${userName}? This will restrict them from splits after their leave date.`);
    if (!confirmLeave) return;

    try {
      const leaveDate = new Date(`${leftAtDate}T00:00:00Z`);
      await api.removeMember(selectedGroupId, userId, leaveDate);
      setMessage(`Logged leave date for ${userName} on ${leftAtDate}`);
      fetchMembers(selectedGroupId);
    } catch (err) {
      setError(err.message || 'Failed to remove member.');
    }
  };

  return (
    <div className="main-content">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Group Timelines</h1>
          <p className="page-description">Configure group memberships, joining dates, and leave histories.</p>
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
        {/* Left Column: Group Memberships */}
        <div>
          {groups.length > 0 ? (
            <div className="card" style={{ padding: '28px' }}>
              <div className="card-header" style={{ marginBottom: '24px' }}>
                <h2>Active Members & Join History</h2>
                <select
                  id="groups-settings-selector"
                  className="filter-select"
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  style={{ padding: '6px 12px', margin: 0, fontWeight: '500' }}
                >
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {members.map(m => {
                  const joinStr = new Date(m.joinedAt).toLocaleDateString(undefined, { timeZone: 'UTC' });
                  const leftStr = m.leftAt ? new Date(m.leftAt).toLocaleDateString(undefined, { timeZone: 'UTC' }) : null;
                  return (
                    <div key={m.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: 'transparent', padding: '16px 0',
                      borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '12px'
                    }}>
                      <div>
                        <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '15px' }}>{m.user.name}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{m.user.email}</div>
                        <div style={{ fontSize: '12px', marginTop: '6px', display: 'flex', gap: '16px' }}>
                          <span style={{ color: 'var(--success)', fontWeight: '500' }}>✓ Joined: {joinStr}</span>
                          {leftStr && <span style={{ color: 'var(--error)', fontWeight: '500' }}>✗ Left: {leftStr}</span>}
                        </div>
                      </div>
                      
                      {!m.leftAt && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="date"
                            className="form-input"
                            value={leftAtDate}
                            onChange={(e) => setLeftAtDate(e.target.value)}
                            style={{ padding: '6px 10px', fontSize: '13px', maxWidth: '140px', boxShadow: 'none' }}
                          />
                          <button
                            onClick={() => handleRemoveMember(m.user.id, m.user.name)}
                            className="btn btn-secondary"
                            style={{ padding: '8px 14px', fontSize: '12px', color: 'var(--error)', borderColor: 'var(--border-color)' }}
                          >
                            Set Leave Date
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add Member Form */}
              <div style={{ marginTop: '36px', borderTop: '1px solid var(--border-color)', paddingTop: '28px' }}>
                <h3 style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '14px', fontWeight: '600' }}>➕ Add Member to Group</h3>
                <form onSubmit={handleAddMember} style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ margin: 0, flex: 2, minWidth: '200px' }}>
                    <label htmlFor="groups-member-email-input">User Email</label>
                    <input
                      id="groups-member-email-input"
                      type="email"
                      className="form-input"
                      placeholder="sam@example.com"
                      value={memberEmail}
                      onChange={(e) => setMemberEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '150px' }}>
                    <label htmlFor="groups-member-join-date">Join Date</label>
                    <input
                      id="groups-member-join-date"
                      type="date"
                      className="form-input"
                      value={joinedAtDate}
                      onChange={(e) => setJoinedAtDate(e.target.value)}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ padding: '10px 20px' }}>Add Member</button>
                </form>
              </div>
            </div>
          ) : (
            <div className="card empty-state">No active groups found. Complete group creation form on the right.</div>
          )}
        </div>

        {/* Right Column: Create Group Form */}
        <div>
          <div className="card" style={{ padding: '24px' }}>
            <div className="card-header">
              <h2>Create New Group</h2>
            </div>
            
            <form onSubmit={handleCreateGroup}>
              <div className="form-group">
                <label htmlFor="groups-new-name-input">Group Name</label>
                <input
                  id="groups-new-name-input"
                  type="text"
                  className="form-input"
                  placeholder="Flat 302"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="groups-new-desc-input">Description (Optional)</label>
                <textarea
                  id="groups-new-desc-input"
                  className="form-input"
                  placeholder="Household utility splits, shared groceries, dinner outings."
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  rows="4"
                  style={{ resize: 'none', fontFamily: 'inherit', lineHeight: '1.4' }}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }}>
                Create Group
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
