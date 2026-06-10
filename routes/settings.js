const express = require('express');
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// GET pengaturan user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT notifikasi_email, notifikasi_push, dark_mode, bahasa FROM settings WHERE user_id = $1',
      [req.user.uid]
    );
    
    if (result.rows.length === 0) {
      await db.query(
        'INSERT INTO settings (user_id, notifikasi_email, notifikasi_push, dark_mode, bahasa) VALUES ($1, $2, $3, $4, $5)',
        [req.user.uid, true, true, 'system', 'id']
      );
      return res.json({
        success: true,
        data: {
          notifikasi_email: true,
          notifikasi_push: true,
          dark_mode: 'system',
          bahasa: 'id'
        }
      });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

// PUT update pengaturan user
router.put('/', authMiddleware, async (req, res) => {
  const { notifikasi_email, notifikasi_push, dark_mode, bahasa } = req.body;
  
  try {
    await db.query(
      `INSERT INTO settings (user_id, notifikasi_email, notifikasi_push, dark_mode, bahasa) 
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         notifikasi_email = EXCLUDED.notifikasi_email,
         notifikasi_push = EXCLUDED.notifikasi_push,
         dark_mode = EXCLUDED.dark_mode,
         bahasa = EXCLUDED.bahasa,
         updated_at = NOW()`,
      [req.user.uid, notifikasi_email ?? true, notifikasi_push ?? true, dark_mode ?? 'system', bahasa ?? 'id']
    );
    
    res.json({ success: true, message: 'Pengaturan berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

// PUT update preferensi notifikasi
router.put('/notifikasi', authMiddleware, async (req, res) => {
  const { notifikasi_email, notifikasi_push } = req.body;
  
  try {
    await db.query(
      `INSERT INTO settings (user_id, notifikasi_email, notifikasi_push, dark_mode, bahasa) 
       VALUES ($1, $2, $3, 'system', 'id')
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         notifikasi_email = EXCLUDED.notifikasi_email,
         notifikasi_push = EXCLUDED.notifikasi_push`,
      [req.user.uid, notifikasi_email ?? true, notifikasi_push ?? true]
    );
    
    res.json({ success: true, message: 'Preferensi notifikasi diupdate' });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

module.exports = router;