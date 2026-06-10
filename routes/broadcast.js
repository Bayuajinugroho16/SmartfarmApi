const express = require('express');
const db = require('../config/db');
const admin = require('firebase-admin');
const router = express.Router();

// Middleware verifikasi token (sederhana)
const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token tidak ditemukan', success: false });
  }
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token tidak valid', success: false });
  }
};

// BROADCAST
router.post('/', verifyToken, async (req, res) => {
  const { title, message, targetUserId } = req.body;

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden', success: false });
  }

  if (!title || !message) {
    return res.status(400).json({ error: 'Judul dan pesan harus diisi', success: false });
  }

  try {
    if (targetUserId) {
      const user = await db.query('SELECT id FROM users WHERE id = $1 AND role = $2', [targetUserId, 'petani']);
      if (user.rows.length === 0) {
        return res.status(404).json({ error: 'Petani tidak ditemukan', success: false });
      }
      await db.query(
        `INSERT INTO notifications (user_id, title, body, type, is_read, created_at) 
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [targetUserId, title, message, 'broadcast', false]
      );
      res.json({ success: true, message: 'Notifikasi terkirim ke petani' });
    } else {
      const users = await db.query("SELECT id FROM users WHERE role = 'petani' AND status = 'Aktif'");
      for (const user of users.rows) {
        await db.query(
          `INSERT INTO notifications (user_id, title, body, type, is_read, created_at) 
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [user.id, title, message, 'broadcast', false]
        );
      }
      res.json({ success: true, message: `Broadcast terkirim ke ${users.rows.length} petani aktif` });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, success: false });
  }
});

module.exports = router;