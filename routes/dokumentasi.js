const express = require('express');
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Setup multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = './uploads/dokumentasi';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file gambar yang diperbolehkan'));
    }
  }
});

// GET semua dokumentasi user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM dokumentasi WHERE user_id = $1 ORDER BY tanggal DESC',
      [req.user.uid]
    );
    
    // Tambahkan URL lengkap untuk gambar
    const data = result.rows.map(row => ({
      ...row,
      image_url: row.image_path ? `${req.protocol}://${req.get('host')}${row.image_path}` : null
    }));
    
    res.json({ success: true, data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// ==================== ENDPOINT UPLOAD FILE ====================
router.post('/upload', authMiddleware, upload.single('foto'), async (req, res) => {
  try {
    const { lahan_id, lahan_nama, keterangan } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'File foto harus diupload', success: false });
    }

    if (!lahan_id) {
      return res.status(400).json({ error: 'Lahan ID harus diisi', success: false });
    }

    const imagePath = `/uploads/dokumentasi/${req.file.filename}`;
    
    const result = await db.query(
      `INSERT INTO dokumentasi (user_id, image_path, lahan_id, lahan_nama, tanggal, keterangan) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [req.user.uid, imagePath, lahan_id, lahan_nama, new Date().toISOString(), keterangan || 'Dokumentasi Tanaman']
    );

    res.status(201).json({
      success: true,
      message: 'Dokumentasi berhasil diupload',
      data: { 
        id: result.rows[0].id, 
        imagePath: imagePath, 
        lahan_id, 
        lahan_nama 
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// POST dokumentasi (JSON only)
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

// UPDATE dokumentasi
router.put('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { keterangan } = req.body;

  try {
    const result = await db.query(
      'UPDATE dokumentasi SET keterangan = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [keterangan, id, req.user.uid]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dokumentasi tidak ditemukan', success: false });
    }
    
    res.json({ success: true, message: 'Dokumentasi berhasil diupdate', data: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// DELETE dokumentasi
router.delete('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const fileResult = await db.query('SELECT image_path FROM dokumentasi WHERE id = $1 AND user_id = $2', [id, req.user.uid]);
    
    await db.query('DELETE FROM dokumentasi WHERE id = $1 AND user_id = $2', [id, req.user.uid]);
    
    if (fileResult.rows.length > 0 && fileResult.rows[0].image_path) {
      const filePath = path.join(__dirname, '..', fileResult.rows[0].image_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    res.json({ success: true, message: 'Dokumentasi berhasil dihapus' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, success: false });
  }
});

module.exports = router;