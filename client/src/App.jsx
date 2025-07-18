import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import './App.css';

ChartJS.register(ArcElement, Tooltip, Legend);

const AssetTracker = () => {
  const [userId, setUserId] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [assets, setAssets] = useState([]);
  const [form, setForm] = useState({ name: '', price: '', date: '' });
  const [error, setError] = useState('');
  const [sortByCost, setSortByCost] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [nameError, setNameError] = useState(false);
  const [dateError, setDateError] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!loggedIn) return;
    const fetchAssets = async () => {
      try {
        const response = await axios.get(`/api/assets?userId=${userId}`);
        setAssets(response.data);
      } catch (error) {
        console.error('Error loading assets:', error);
      }
    };

    fetchAssets();
  }, [loggedIn, userId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    setError('');
    setFormError('');
    if (name === 'name') setNameError(false);
    if (name === 'date') setDateError(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { name, price, date } = form;
    if (!name) {
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

    const isDuplicate = assets.some(a => a.name === name && a.date === date);
    if (isDuplicate && editingIndex === null) {
      return setFormError('Duplicate asset entry');
    }

    const newAsset = { name, price: parseFloat(price), date, userId };

    try {
      if (editingIndex !== null) {
        const assetToUpdate = assets[editingIndex];
        const response = await axios.put(`${import.meta.env.VITE_API_BASE_URL}/api/assets/${assetToUpdate._id}`, newAsset);
        const updatedAssets = [...assets];
        updatedAssets[editingIndex] = response.data;
        setAssets(updatedAssets);
        setEditingIndex(null);
      } else {
        await axios.post(`${import.meta.env.VITE_API_BASE_URL}/api/assets`, newAsset);
        const refreshed = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/assets?userId=${userId}`);
        setAssets(refreshed.data);
      }

      setForm({ name: '', price: '', date: '' });
    } catch (error) {
      console.error('Error saving asset:', error);
      if (error.response?.data?.errors) {
        const messages = error.response.data.errors.map((e) => `- ${e.msg}`).join('\n');
        setError(`Validation error:\n${messages}`);
      } else {
        setError('Failed to save asset');
      }
    }
  };

  const handleDelete = async (index) => {
    const assetToDelete = assets[index];
    try {
      await axios.delete(`${import.meta.env.VITE_API_BASE_URL}/api/assets/${assetToDelete._id}`);
      setAssets(assets.filter((_, i) => i !== index));
      if (editingIndex === index) setEditingIndex(null);
    } catch (error) {
      console.error('Error deleting asset:', error);
    }
  };

  const handleEdit = (index) => {
    const asset = assets[index];
    setForm({ name: asset.name, price: asset.price.toString(), date: asset.date });
    setEditingIndex(index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const sortedAssets = sortByCost
    ? [...assets].sort((a, b) => b.dailyCost - a.dailyCost)
    : assets;

  const pieData = {
    labels: assets.map((a) => a.name),
    datasets: [
      {
        label: 'Total ¥',
        data: assets.map((a) => a.price),
        backgroundColor: [
          '#60a5fa', '#f87171', '#34d399', '#fbbf24', '#a78bfa', '#f472b6', '#fb923c'
        ]
      }
    ]
  };

  return (
    <div className="App">
      <div className="login-container">
        {!loggedIn ? (
          <div className="login-box">
            <h2 className="login-title">Login</h2>
            <input
              type="text"
              placeholder="Enter your username"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="login-input"
            />
            <button
              onClick={() => setLoggedIn(true)}
              disabled={!userId.trim()}
              className="login-button"
            >
              Login
            </button>
          </div>
        ) : (
          <div className="logout-bar">
            <p className="welcome-text">Welcome, <span className="user-name">{userId}</span></p>
            <button
              onClick={() => {
                setLoggedIn(false);
                setUserId('');
                setAssets([]);
              }}
              className="logout-button"
            >
              Logout
            </button>
          </div>
        )}
        <h1 className="app-title">Asset Tracker</h1>

        <form onSubmit={handleSubmit} className="asset-form">
          {formError && <div className="form-error">{formError}</div>}
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          <div>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Item Name"
              className={nameError ? 'error-border' : 'form-input'}
            />
            {nameError && <p className="field-error">Name is required</p>}
          </div>
          <div>
            <input
              name="price"
              value={form.price}
              onChange={handleChange}
              placeholder="Price (¥)"
              type="number"
              className="form-input"
            />
          </div>
          <div>
            <input
              name="date"
              value={form.date}
              onChange={handleChange}
              type="date"
              className={dateError ? 'error-border' : 'form-input'}
            />
            {dateError && <p className="field-error">Invalid date</p>}
          </div>
          <div className="form-submit-container">
            <button
              type="submit"
              className="form-submit"
            >
              {editingIndex !== null ? 'Update Asset' : 'Add Asset'}
            </button>
          </div>
        </form>
        <div className="export-buttons" style={{ display: 'flex', gap: '1rem' }}>
          <a
            href={`${import.meta.env.VITE_API_BASE_URL}/api/assets/export`}
            className="export-csv"
          >
            Export CSV  
          </a>
          <a
            href={`${import.meta.env.VITE_API_BASE_URL}/api/assets/export-json`}
            className="export-json"
          >
            Export JSON
          </a>
        </div>
        <button
          className="sort-toggle"
          onClick={() => setSortByCost(!sortByCost)}
        >
          Sort by Daily Cost {sortByCost ? '(On)' : '(Off)'}
        </button>

        <div className="asset-list">
          {sortedAssets.map((item, index) => (
            <div key={index} className="asset-card">
              <div>
                <div className="asset-name">{item.name}</div>
                <div className="asset-details">
                  ¥{item.price.toFixed(0)} | {item.daysUsed} 天
                  <span className="daily-cost">
                    {typeof item.dailyCost === 'number' && !isNaN(item.dailyCost)
                      ? `¥${item.dailyCost.toFixed(2)}/天`
                      : 'N/A'}
                  </span>
                </div>
              </div>
              <div className="asset-actions">
                <button
                  onClick={() => handleEdit(index)}
                  className="edit-button"
                >Edit</button>
                <button
                  onClick={() => handleDelete(index)}
                  className="delete-button"
                >Delete</button>
              </div>
            </div>
          ))}
        </div>

        {assets.length > 0 && (
          <div className="chart-section">
            <h2 className="chart-title">Spending Breakdown</h2>
            <div className="chart-container">
              <Pie data={pieData} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetTracker;