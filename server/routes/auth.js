const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';

// 登录接口
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: 'User not found' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Invalid password' });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, userId: user._id });
  } catch (err) {
    res.status(500).json({ message: 'Login error', error: err.message });
  }
});

// 注册接口（可选）
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashed });
    await newUser.save();
    res.status(201).json({ message: 'User created' });
  } catch (err) {
    res.status(500).json({ message: 'Register error', error: err.message });
  }
});

module.exports = router;