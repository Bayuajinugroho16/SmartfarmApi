const express = require('express');
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// ==================== SEARCH ====================

router.get('/search', authMiddleware, async (req, res) => {
  const { q, tipe = 'all' } = req.query;
  
  if (!q || q.length < 2) {
    return res.status(400).json({ error: 'Minimal 2 karakter', success: false });
  }
  
  try {
    const searchPattern = `%${q}%`;
    let results = {};
    
    if (tipe === 'all' || tipe === 'catatan') {
      const catatan = await db.query(
        'SELECT id, judul, deskripsi, tanggal, $1 as tipe FROM catatan WHERE user_id = $2 AND (judul ILIKE $3 OR deskripsi ILIKE $3)',
        ['catatan', req.user.uid, searchPattern]
      );
      results.catatan = catatan.rows;
    }
    
    if (tipe === 'all' || tipe === 'jadwal') {
      const jadwal = await db.query(
        'SELECT id, judul, tanggal, status, $1 as tipe FROM jadwal WHERE user_id = $2 AND judul ILIKE $3',
        ['jadwal', req.user.uid, searchPattern]
      );
      results.jadwal = jadwal.rows;
    }
    
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

// ==================== BACKUP ====================

router.post('/backup', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.uid;
    
    const profile = await db.query('SELECT name, email, lahan FROM users WHERE id = $1', [userId]);
    const catatan = await db.query('SELECT judul, deskripsi, tanggal FROM catatan WHERE user_id = $1', [userId]);
    const jadwal = await db.query('SELECT judul, tanggal, status FROM jadwal WHERE user_id = $1', [userId]);
    
    const backup = {
      user: profile.rows[0],
      catatan: catatan.rows,
      jadwal: jadwal.rows,
      tanggal_backup: new Date().toISOString()
    };
    
    res.json({
      success: true,
      message: 'Backup berhasil',
      data: backup
    });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

// ==================== REKOMENDASI ====================

router.get('/rekomendasi', authMiddleware, async (req, res) => {
  try {
    const lastPanen = await db.query(
      'SELECT tanggal FROM jadwal WHERE user_id = $1 AND judul ILIKE $2 ORDER BY tanggal DESC LIMIT 1',
      [req.user.uid, '%panen%']
    );
    
    const rekomendasi = [];
    
    if (lastPanen.rows.length > 0) {
      const lastDate = new Date(lastPanen.rows[0].tanggal);
      const nextDate = new Date(lastDate);
      nextDate.setMonth(nextDate.getMonth() + 4);
      rekomendasi.push({
        judul: 'Persiapan Lahan',
        tanggal: nextDate.toISOString().split('T')[0],
        alasan: 'Berdasarkan siklus panen sebelumnya'
      });
    } else {
      rekomendasi.push({
        judul: 'Mulai Tanam Cabai',
        tanggal: new Date().toISOString().split('T')[0],
        alasan: 'Musim tanam yang baik'
      });
    }
    
    res.json({ success: true, data: rekomendasi });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

// ==================== AKTIVITAS TERBARU ====================

router.get('/aktivitas-terbaru', authMiddleware, async (req, res) => {
  const { limit = 20 } = req.query;
  
  try {
    const catatan = await db.query(
      'SELECT id, judul, deskripsi, tanggal, created_at, $1 as tipe FROM catatan WHERE user_id = $2 ORDER BY created_at DESC LIMIT $3',
      ['catatan', req.user.uid, limit]
    );
    
    const jadwal = await db.query(
      'SELECT id, judul, tanggal, status, created_at, $1 as tipe FROM jadwal WHERE user_id = $2 ORDER BY created_at DESC LIMIT $3',
      ['jadwal', req.user.uid, limit]
    );
    
    let aktivitas = [...catatan.rows, ...jadwal.rows];
    aktivitas.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    aktivitas = aktivitas.slice(0, limit);
    
    res.json({ success: true, data: aktivitas });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

module.exports = router;