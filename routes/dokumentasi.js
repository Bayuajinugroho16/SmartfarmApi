const express = require('express');
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// GET semua dokumentasi user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM dokumentasi WHERE user_id = $1 ORDER BY tanggal DESC',
      [req.user.uid]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// POST dokumentasi baru
router.post('/', authMiddleware, async (req, res) => {
  const { imagePath, lahanId, lahanNama, tanggal, keterangan } = req.body;

  if (!imagePath || !lahanId) {
    return res.status(400).json({ error: 'Image path dan lahan ID harus diisi', success: false });
  }

  try {
    const result = await db.query(
      `INSERT INTO dokumentasi (user_id, image_path, lahan_id, lahan_nama, tanggal, keterangan) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [req.user.uid, imagePath, lahanId, lahanNama, tanggal || new Date().toISOString(), keterangan || 'Dokumentasi Tanaman']
    );

    res.status(201).json({
      success: true,
      message: 'Dokumentasi berhasil ditambahkan',
      data: { id: result.rows[0].id, imagePath, lahanId, lahanNama }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// DELETE dokumentasi
router.delete('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    await db.query('DELETE FROM dokumentasi WHERE id = $1 AND user_id = $2', [id, req.user.uid]);
    res.json({ success: true, message: 'Dokumentasi berhasil dihapus' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, success: false });
  }
});

module.exports = router;