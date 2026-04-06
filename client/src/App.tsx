import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import { User, ApiResponse } from './types';
import './App.css';

// Register Chart.js components globally
ChartJS.register(ArcElement, Tooltip, Legend);

interface FormData {
  name: string;
  price: string;
  date: string;
}

interface AssetResponse {
  _id: string;
  name: string;
  price: number;
  date: string;
  userId: string;
  daysUsed: number;
  dailyCost: number;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const AssetTracker: React.FC = () => {
  const storedUser = localStorage.getItem('username');
  const [username, setUsername] = useState<string>(storedUser || '');
  const [userId, setUserId] = useState<string>('');
  const [loggedIn, setLoggedIn] = useState<boolean>(false);
  const [assets, setAssets] = useState<AssetResponse[]>([]);
  const [form, setForm] = useState<FormData>({ name: '', price: '', date: '' });
  const [error, setError] = useState<string>('');
  const [sortByCost, setSortByCost] = useState<boolean>(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [nameError, setNameError] = useState<boolean>(false);
  const [dateError, setDateError] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'error'>('checking');

  // Fetch assets when user logs in
  useEffect(() => {
    if (!loggedIn) return;
    
    const fetchAssets = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get<AssetResponse[]>(
          `${API_BASE_URL}/api/assets?userId=${userId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );
        setAssets(response.data);
      } catch (error) {
        console.error('Error loading assets:', error);
        setError('Failed to load assets');
      }
    };

    fetchAssets();
  }, [loggedIn, userId]);

  // Check for saved user session and backend health
  useEffect(() => {
    const savedUsername = localStorage.getItem('username');
    const savedToken = localStorage.getItem('token');
    
    if (savedUsername && savedToken) {
      setUsername(savedUsername);
      setUserId(savedUsername);
      setLoggedIn(true);
    }

    const checkBackend = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/health`);
        if (res.status === 200) {
          setBackendStatus('connected');
        } else {
          setBackendStatus('error');
        }
      } catch (err) {
        console.error('Backend health check failed:', err);
        setBackendStatus('error');
      }
    };

    checkBackend();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setError('');
    setFormError('');
    if (name === 'name') setNameError(false);
    if (name === 'date') setDateError(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { name, price, date } = form;

    // Validation
    if (!name.trim()) {
      setNameError(true);
      return setFormError('Asset name is required');
    }
    
    if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
      return setFormError('Price must be a positive number');
    }
    
    const dateObj = new Date(date);
    if (!date || isNaN(dateObj.getTime())) {
      setDateError(true);
      return setFormError('Date format is invalid');
    }

    // Check for duplicates (only when adding new)
    const isDuplicate = assets.some(a => a.name === name && a.date === date);
    if (isDuplicate && editingIndex === null) {
      return setFormError('Duplicate asset entry');
    }

    const newAsset = { 
      name: name.trim(), 
      price: parseFloat(price), 
      date, 
      userId 
    };

    try {
      const token = localStorage.getItem('token');
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      if (editingIndex !== null) {
        // Update existing asset
        const assetToUpdate = assets[editingIndex];
        const response = await axios.put<AssetResponse>(
          `${API_BASE_URL}/api/assets/${assetToUpdate._id}`, 
          newAsset,
          { headers }
        );
        
        const updatedAssets = [...assets];
        updatedAssets[editingIndex] = response.data;
        setAssets(updatedAssets);
        setEditingIndex(null);
      } else {
        // Add new asset
        await axios.post(
          `${API_BASE_URL}/api/assets`, 
          newAsset,
          { headers }
        );
        
        // Refresh assets list
        const refreshed = await axios.get<AssetResponse[]>(
          `${API_BASE_URL}/api/assets?userId=${userId}`,
          { headers }
        );
        setAssets(refreshed.data);
      }

      setForm({ name: '', price: '', date: '' });
      setError('');
      setFormError('');
    } catch (error: any) {
      console.error('Error saving asset:', error);
      
      if (error.response?.data?.errors) {
        const messages = error.response.data.errors
          .map((e: any) => `- ${e.msg}`)
          .join('\\n');
        setError(`Validation error:\\n${messages}`);
      } else if (error.response?.data?.message) {
        setError(error.response.data.message);
      } else {
        setError('Failed to save asset');
      }
    }
  };

  const handleDelete = async (index: number) => {
    const assetToDelete = assets[index];
    
    if (!confirm(`Are you sure you want to delete "${assetToDelete.name}"?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${API_BASE_URL}/api/assets/${assetToDelete._id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      setAssets(prevAssets => prevAssets.filter((_, i) => i !== index));
      
      if (editingIndex === index) {
        setEditingIndex(null);
        setForm({ name: '', price: '', date: '' });
      }
    } catch (error) {
      console.error('Error deleting asset:', error);
      setError('Failed to delete asset');
    }
  };

  const handleEdit = (index: number) => {
    const asset = assets[index];
    setForm({ 
      name: asset.name, 
      price: asset.price.toString(), 
      date: asset.date 
    });
    setEditingIndex(index);
    setError('');
    setFormError('');
    
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogin = async () => {
    if (!userId.trim()) {
      return;
    }

    try {
      const response = await axios.post<ApiResponse<{ token: string; user: User }>>(
        `${API_BASE_URL}/api/auth/login`,
        {
          username: userId.trim(),
          password: 'dummy' // This should be replaced with proper authentication
        }
      );

      const token =
        response.data.data?.token ||
        (response.data as ApiResponse<{ token: string }> & { token?: string }).token;

      if (!token) {
        throw new Error('Login response did not contain a token');
      }

      localStorage.setItem('username', userId.trim());
      localStorage.setItem('token', token);

      setLoggedIn(true);
      setUsername(userId.trim());
      setError('');
    } catch (err: any) {
      console.error('Login failed:', err);
      const errorMessage = err.response?.data?.message || 'Login failed';
      setError(errorMessage);
    }
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setUserId('');
    setUsername('');
    setAssets([]);
    setForm({ name: '', price: '', date: '' });
    setEditingIndex(null);
    setError('');
    setFormError('');
    
    localStorage.removeItem('username');
    localStorage.removeItem('token');
  };

  // Sort assets by daily cost if enabled
  const sortedAssets = sortByCost
    ? [...assets].sort((a, b) => (b.dailyCost || 0) - (a.dailyCost || 0))
    : assets;

  // Prepare chart data
  const pieData = {
    labels: assets.map(a => a.name),
    datasets: [
      {
        label: 'Total ¥',
        data: assets.map(a => a.price),
        backgroundColor: [
          '#60a5fa', '#f87171', '#34d399', '#fbbf24', 
          '#a78bfa', '#f472b6', '#fb923c', '#10b981',
          '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6'
        ],
        borderWidth: 1
      }
    ]
  };

  return (
    <div className="App">
      <div className="login-container">
        {!loggedIn ? (
          <div className="login-box">
            <h2 className="login-title">Asset Tracker Login</h2>
            {error && (
              <div className="error-message" role="alert">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="username-input" className="sr-only">
                Username
              </label>
              <input
                id="username-input"
                type="text"
                placeholder="Enter your username"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="login-input"
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                autoFocus
                aria-describedby={error ? 'login-error' : undefined}
              />
            </div>
            <button
              onClick={handleLogin}
              disabled={!userId.trim()}
              className="login-button"
              type="button"
            >
              Login
            </button>
          </div>
        ) : (
          <div className="logout-bar">
            <p className="welcome-text">
              Welcome, <span className="user-name">{username}</span>
            </p>
            <button
              onClick={handleLogout}
              className="logout-button"
              type="button"
            >
              Logout
            </button>
            <p className="backend-status">
              Backend Status: {' '}
              <span 
                className={`status-indicator status-${backendStatus}`}
                style={{ 
                  color: backendStatus === 'connected' ? 'green' : 'red',
                  fontWeight: 'bold'
                }}
              >
                {backendStatus}
              </span>
            </p>
          </div>
        )}

        {loggedIn && (
          <>
            <h1 className="app-title">Asset Tracker</h1>

            <form onSubmit={handleSubmit} className="asset-form" noValidate>
              <fieldset>
                <legend className="sr-only">Asset Information</legend>
                
                {formError && (
                  <div className="form-error" role="alert" id="form-error">
                    {formError}
                  </div>
                )}
                
                {error && (
                  <div className="error-message" role="alert">
                    {error}
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="asset-name" className="sr-only">
                    Asset Name
                  </label>
                  <input
                    id="asset-name"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Asset Name"
                    className={nameError ? 'error-border form-input' : 'form-input'}
                    aria-invalid={nameError}
                    aria-describedby={nameError ? 'name-error' : undefined}
                    required
                  />
                  {nameError && (
                    <p className="field-error" id="name-error" role="alert">
                      Name is required
                    </p>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="asset-price" className="sr-only">
                    Price in Yuan
                  </label>
                  <input
                    id="asset-price"
                    name="price"
                    value={form.price}
                    onChange={handleChange}
                    placeholder="Price (¥)"
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="asset-date" className="sr-only">
                    Purchase Date
                  </label>
                  <input
                    id="asset-date"
                    name="date"
                    value={form.date}
                    onChange={handleChange}
                    type="date"
                    className={dateError ? 'error-border form-input' : 'form-input'}
                    aria-invalid={dateError}
                    aria-describedby={dateError ? 'date-error' : undefined}
                    required
                  />
                  {dateError && (
                    <p className="field-error" id="date-error" role="alert">
                      Invalid date
                    </p>
                  )}
                </div>

                <div className="form-submit-container">
                  <button
                    type="submit"
                    className="form-submit"
                    disabled={!form.name || !form.price || !form.date}
                  >
                    {editingIndex !== null ? 'Update Asset' : 'Add Asset'}
                  </button>
                  {editingIndex !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingIndex(null);
                        setForm({ name: '', price: '', date: '' });
                        setError('');
                        setFormError('');
                      }}
                      className="cancel-button"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </fieldset>
            </form>

            {assets.length > 0 && (
              <div className="controls">
                <button
                  className="sort-toggle"
                  onClick={() => setSortByCost(!sortByCost)}
                  type="button"
                  aria-pressed={sortByCost}
                >
                  Sort by Daily Cost {sortByCost ? '(Enabled)' : '(Disabled)'}
                </button>
              </div>
            )}

            <div className="asset-list" role="list" aria-label="Asset list">
              {sortedAssets.length === 0 ? (
                <div className="empty-state">
                  <p>No assets found. Add your first asset above!</p>
                </div>
              ) : (
                sortedAssets.map((item, index) => (
                  <div 
                    key={`${item._id}-${index}`} 
                    className="asset-card"
                    role="listitem"
                  >
                    <div className="asset-info">
                      <div className="asset-name">{item.name}</div>
                      <div className="asset-details">
                        ¥{item.price.toFixed(2)} | {item.daysUsed} days
                        <span className="daily-cost">
                          {typeof item.dailyCost === 'number' && !isNaN(item.dailyCost)
                            ? `¥${item.dailyCost.toFixed(2)}/day`
                            : 'Cost calculation unavailable'}
                        </span>
                      </div>
                    </div>
                    <div className="asset-actions">
                      <button
                        onClick={() => handleEdit(index)}
                        className="edit-button"
                        type="button"
                        aria-label={`Edit ${item.name}`}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(index)}
                        className="delete-button"
                        type="button"
                        aria-label={`Delete ${item.name}`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {assets.length > 0 && (
              <div className="chart-section">
                <h2 className="chart-title">Spending Breakdown</h2>
                <div className="chart-container">
                  <Pie 
                    data={pieData} 
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          position: 'bottom' as const
                        },
                        tooltip: {
                          callbacks: {
                            label: (context) => {
                              const label = context.label || '';
                              const value = context.parsed;
                              const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                              const percentage = ((value / total) * 100).toFixed(1);
                              return `${label}: ¥${value.toFixed(2)} (${percentage}%)`;
                            }
                          }
                        }
                      }
                    }}
                    aria-label="Chart showing asset spending breakdown"
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AssetTracker;
