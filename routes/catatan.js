const express = require('express');
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// GET semua catatan user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM catatan WHERE user_id = $1 ORDER BY tanggal DESC',
      [req.user.uid]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// POST catatan baru
router.post('/', authMiddleware, async (req, res) => {
  const { judul, deskripsi, tanggal } = req.body;

  if (!judul || !deskripsi || !tanggal) {
    return res.status(400).json({ error: 'Semua field harus diisi', success: false });
  }

  try {
    const result = await db.query(
      'INSERT INTO catatan (user_id, judul, deskripsi, tanggal) VALUES ($1, $2, $3, $4) RETURNING id',
      [req.user.uid, judul, deskripsi, tanggal]
    );

    res.status(201).json({
      success: true,
      message: 'Catatan berhasil ditambahkan',
      data: { id: result.rows[0].id, judul, deskripsi, tanggal }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// PUT update catatan
router.put('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { judul, deskripsi, tanggal } = req.body;

  try {
    await db.query(
      'UPDATE catatan SET judul = $1, deskripsi = $2, tanggal = $3 WHERE id = $4 AND user_id = $5',
      [judul, deskripsi, tanggal, id, req.user.uid]
    );
    res.json({ success: true, message: 'Catatan berhasil diupdate' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// DELETE catatan
router.delete('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    await db.query('DELETE FROM catatan WHERE id = $1 AND user_id = $2', [id, req.user.uid]);
    res.json({ success: true, message: 'Catatan berhasil dihapus' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, success: false });
  }
});

module.exports = router;