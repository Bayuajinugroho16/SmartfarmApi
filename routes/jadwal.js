const express = require('express');
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// GET semua jadwal user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM jadwal WHERE user_id = $1 ORDER BY tanggal ASC',
      [req.user.uid]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// POST jadwal baru
router.post('/', authMiddleware, async (req, res) => {
  const { judul, tanggal, status } = req.body;

  if (!judul || !tanggal) {
    return res.status(400).json({ error: 'Judul dan tanggal harus diisi', success: false });
  }

  try {
    const result = await db.query(
      'INSERT INTO jadwal (user_id, judul, tanggal, status) VALUES ($1, $2, $3, $4) RETURNING id',
      [req.user.uid, judul, tanggal, status || 'Belum']
    );

    res.status(201).json({
      success: true,
      message: 'Jadwal berhasil ditambahkan',
      data: { id: result.rows[0].id, judul, tanggal, status: status || 'Belum' }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// PUT update status jadwal
router.put('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    await db.query(
      'UPDATE jadwal SET status = $1 WHERE id = $2 AND user_id = $3',
      [status, id, req.user.uid]
    );
    res.json({ success: true, message: 'Status jadwal berhasil diupdate' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// DELETE jadwal
router.delete('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    await db.query('DELETE FROM jadwal WHERE id = $1 AND user_id = $2', [id, req.user.uid]);
    res.json({ success: true, message: 'Jadwal berhasil dihapus' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, success: false });
  }
});

module.exports = router;