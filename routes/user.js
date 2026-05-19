const express = require('express');
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// GET profil user
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, email, role, status, lahan, created_at 
       FROM users WHERE id = $1`,
      [req.user.uid]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User tidak ditemukan', success: false });
    }

    const user = result.rows[0];
    
    // Hitung statistik
    const catatanCount = await db.query('SELECT COUNT(*) as total FROM catatan WHERE user_id = $1', [req.user.uid]);
    const jadwalCount = await db.query('SELECT COUNT(*) as total FROM jadwal WHERE user_id = $1', [req.user.uid]);

    res.json({
      success: true,
      data: {
        uid: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        lahan: user.lahan,
        createdAt: user.created_at,
        stats: {
          totalCatatan: parseInt(catatanCount.rows[0].total),
          totalJadwal: parseInt(jadwalCount.rows[0].total)
        }
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// PUT update profil
router.put('/profile', authMiddleware, async (req, res) => {
  const { name, lahan } = req.body;

  try {
    await db.query(
      'UPDATE users SET name = $1, lahan = $2 WHERE id = $3',
      [name, lahan, req.user.uid]
    );
    res.json({ success: true, message: 'Profil berhasil diupdate' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, success: false });
  }
});

module.exports = router;