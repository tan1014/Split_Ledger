const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api';

async function request(url, options = {}) {
  const token = localStorage.getItem('token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Auth
  login: (email, password) => 
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (name, email, password) => 
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),
  getMe: () => request('/auth/me'),

  // Groups
  getGroups: () => request('/groups'),
  createGroup: (name, description) => 
    request('/groups', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    }),
  getMembers: (groupId) => request(`/groups/${groupId}/members`),
  addMember: (groupId, email, joinedAt) => 
    request(`/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ email, joinedAt }),
    }),
  removeMember: (groupId, userId, leftAt) => 
    request(`/groups/${groupId}/members/${userId}`, {
      method: 'DELETE',
      body: JSON.stringify({ leftAt }),
    }),

  // Expenses
  getExpenses: (groupId) => request(`/groups/${groupId}/expenses`),
  createExpense: (groupId, data) => 
    request(`/groups/${groupId}/expenses`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteExpense: (groupId, expenseId) => 
    request(`/groups/${groupId}/expenses/${expenseId}`, {
      method: 'DELETE',
    }),

  // Balances
  getBalances: (groupId) => request(`/groups/${groupId}/balances`),
  getExplanation: (groupId, userId) => request(`/groups/${groupId}/balances/explain/${userId}`),
  recordSettlement: (groupId, data) => 
    request(`/groups/${groupId}/balances/settle`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // CSV Importer
  uploadCSV: (groupId, fileName, csvText) => 
    request(`/groups/${groupId}/import/upload`, {
      method: 'POST',
      body: JSON.stringify({ fileName, csvText }),
    }),
  getImportJob: (groupId, jobId) => request(`/groups/${groupId}/import/jobs/${jobId}`),
  resolveImport: (groupId, jobId, decisions, parsedRows) => 
    request(`/groups/${groupId}/import/jobs/${jobId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ decisions, parsedRows }),
    }),

  // Audit
  getExchangeRates: () => request('/audit/rates'),
  getAuditLogs: () => request('/audit/logs'),
};
