const express = require('express');
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// GET semua notifikasi user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.uid]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

// GET notifikasi yang belum dibaca
router.get('/unread', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM notifications WHERE user_id = $1 AND is_read = false ORDER BY created_at DESC',
      [req.user.uid]
    );
    res.json({ success: true, data: result.rows, unreadCount: result.rows.length });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

// PUT tandai notifikasi sudah dibaca
router.put('/:id/read', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
      [id, req.user.uid]
    );
    res.json({ success: true, message: 'Notifikasi ditandai sudah dibaca' });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

// PUT tandai semua notifikasi sudah dibaca
router.put('/read-all', authMiddleware, async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1',
      [req.user.uid]
    );
    res.json({ success: true, message: 'Semua notifikasi ditandai sudah dibaca' });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

// DELETE hapus notifikasi
router.delete('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM notifications WHERE id = $1 AND user_id = $2', [id, req.user.uid]);
    res.json({ success: true, message: 'Notifikasi dihapus' });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

// DELETE hapus semua notifikasi
router.delete('/', authMiddleware, async (req, res) => {
  try {
    await db.query('DELETE FROM notifications WHERE user_id = $1', [req.user.uid]);
    res.json({ success: true, message: 'Semua notifikasi dihapus' });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

module.exports = router;