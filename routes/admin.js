const express = require('express');
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Middleware untuk cek role admin
const adminOnly = async (req, res, next) => {
  const user = req.user;
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden', success: false });
  }
  next();
};

// GET semua petani
router.get('/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, name, email, status, lahan, created_at FROM users WHERE role = 'petani' ORDER BY created_at DESC"
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

// GET semua petani
router.get('/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, name, email, status, lahan, created_at FROM users WHERE role = 'petani' ORDER BY created_at DESC"
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

// GET catatan petani tertentu
router.get('/users/:id/catatan', authMiddleware, adminOnly, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      'SELECT * FROM catatan WHERE user_id = $1 ORDER BY tanggal DESC',
      [id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

// GET jadwal petani tertentu
router.get('/users/:id/jadwal', authMiddleware, adminOnly, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      'SELECT * FROM jadwal WHERE user_id = $1 ORDER BY tanggal ASC',
      [id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

module.exports = router;