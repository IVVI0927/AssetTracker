import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';

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

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-start justify-start p-8">
        <div className="bg-white p-6 rounded shadow w-full max-w-xl">
          <h2 className="text-xl font-semibold mb-4 text-center text-blue-600">Login</h2>
          <input
            type="text"
            placeholder="Enter your username"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="mb-4 w-full border rounded px-3 py-2"
          />
          <button
            onClick={() => setLoggedIn(true)}
            disabled={!userId.trim()}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

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
    <div className="min-h-screen bg-gray-100 text-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-blue-600">Asset Tracker</h1>

        <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-4 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {formError && <div className="text-red-600 text-sm mb-2 animate-pulse">{formError}</div>}
          {error && (
            <div className="bg-red-100 text-red-700 p-2 rounded mb-2 text-sm">
              {error}
            </div>
          )}
          <div>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Item Name"
              className={`w-full border rounded px-3 py-2 ${nameError ? 'border-red-500 animate-pulse' : ''}`}
            />
            {nameError && <p className="text-red-500 text-xs mt-1">Name is required</p>}
          </div>
          <div>
            <input
              name="price"
              value={form.price}
              onChange={handleChange}
              placeholder="Price (¥)"
              type="number"
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <input
              name="date"
              value={form.date}
              onChange={handleChange}
              type="date"
              className={`w-full border rounded px-3 py-2 ${dateError ? 'border-red-500 animate-pulse' : ''}`}
            />
            {dateError && <p className="text-red-500 text-xs mt-1">Invalid date</p>}
          </div>
          <div className="sm:col-span-3">
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              {editingIndex !== null ? 'Update Asset' : 'Add Asset'}
            </button>
          </div>
        </form>
        <div className="flex gap-4 mb-4">
          <a
            href={`${import.meta.env.VITE_API_BASE_URL}/api/assets/export`}
            className="bg-green-500 text-white py-1 px-3 rounded hover:bg-green-600 text-sm"
          >
            Export CSV
          </a>
          <a
            href={`${import.meta.env.VITE_API_BASE_URL}/api/assets/export-json`}
            className="bg-purple-500 text-white py-1 px-3 rounded hover:bg-purple-600 text-sm"
          >
            Export JSON
          </a>
        </div>
        <button
          className="mb-4 text-sm text-blue-500 hover:underline"
          onClick={() => setSortByCost(!sortByCost)}
        >
          Sort by Daily Cost {sortByCost ? '(On)' : '(Off)'}
        </button>

        <div className="space-y-4">
          {sortedAssets.map((item, index) => (
            <div key={index} className="bg-white p-4 rounded-lg shadow flex flex-col sm:flex-row justify-between sm:items-center gap-2">
              <div>
                <div className="font-bold text-lg">{item.name}</div>
                <div className="text-sm text-gray-600">
                  ¥{item.price.toFixed(0)} | {item.daysUsed} 天
                  <span className="ml-2 text-blue-600 font-semibold">
                    {typeof item.dailyCost === 'number' && !isNaN(item.dailyCost)
                      ? `¥${item.dailyCost.toFixed(2)}/天`
                      : 'N/A'}
                  </span>
                </div>
              </div>
              <div className="text-xs text-gray-500 space-x-2 mt-1">
                <button
                  onClick={() => handleEdit(index)}
                  className="text-blue-500 hover:underline"
                >Edit</button>
                <button
                  onClick={() => handleDelete(index)}
                  className="text-red-500 hover:underline"
                >Delete</button>
              </div>
            </div>
          ))}
        </div>

        {assets.length > 0 && (
          <div className="bg-white mt-10 p-4 rounded shadow">
            <h2 className="text-lg font-semibold mb-4 text-gray-700">Spending Breakdown</h2>
            <div className="max-w-md mx-auto h-[300px]">
              <Pie data={pieData} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetTracker;