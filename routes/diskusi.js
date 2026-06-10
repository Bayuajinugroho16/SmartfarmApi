const express = require('express');
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// ==================== DISKUSI ====================

// GET semua diskusi
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT d.*, u.name as author_name 
       FROM diskusi d 
       JOIN users u ON d.user_id = u.id 
       ORDER BY d.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

// GET diskusi by ID
router.get('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const diskusi = await db.query(
      `SELECT d.*, u.name as author_name 
       FROM diskusi d 
       JOIN users u ON d.user_id = u.id 
       WHERE d.id = $1`,
      [id]
    );
    
    const komentar = await db.query(
      `SELECT k.*, u.name as author_name 
       FROM komentar k 
       JOIN users u ON k.user_id = u.id 
       WHERE k.diskusi_id = $1 
       ORDER BY k.created_at ASC`,
      [id]
    );
    
    res.json({ 
      success: true, 
      data: {
        diskusi: diskusi.rows[0],
        komentar: komentar.rows
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

// POST buat diskusi baru
router.post('/', authMiddleware, async (req, res) => {
  const { judul, konten, kategori = 'umum' } = req.body;
  
  if (!judul || !konten) {
    return res.status(400).json({ error: 'Judul dan konten harus diisi', success: false });
  }
  
  try {
    const result = await db.query(
      'INSERT INTO diskusi (user_id, judul, konten, kategori, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id',
      [req.user.uid, judul, konten, kategori]
    );
    
    res.status(201).json({
      success: true,
      message: 'Diskusi berhasil dibuat',
      data: { id: result.rows[0].id }
    });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

// DELETE hapus diskusi
router.delete('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  
  try {
    const diskusi = await db.query('SELECT user_id FROM diskusi WHERE id = $1', [id]);
    if (diskusi.rows[0]?.user_id !== req.user.uid && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden', success: false });
    }
    
    await db.query('DELETE FROM diskusi WHERE id = $1', [id]);
    res.json({ success: true, message: 'Diskusi dihapus' });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

// ==================== KOMENTAR ====================

// POST tambah komentar
router.post('/:id/komentar', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { konten } = req.body;
  
  if (!konten) {
    return res.status(400).json({ error: 'Komentar harus diisi', success: false });
  }
  
  try {
    const result = await db.query(
      'INSERT INTO komentar (diskusi_id, user_id, konten, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id',
      [id, req.user.uid, konten]
    );
    
    res.status(201).json({
      success: true,
      message: 'Komentar ditambahkan',
      data: { id: result.rows[0].id }
    });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

// DELETE hapus komentar
router.delete('/komentar/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  
  try {
    const komentar = await db.query('SELECT user_id FROM komentar WHERE id = $1', [id]);
    if (komentar.rows[0]?.user_id !== req.user.uid && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden', success: false });
    }
    
    await db.query('DELETE FROM komentar WHERE id = $1', [id]);
    res.json({ success: true, message: 'Komentar dihapus' });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

module.exports = router;