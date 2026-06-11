const express = require('express');
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const router = express.Router();

// ==================== KONFIGURASI CLOUDINARY ====================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log('✅ Cloudinary configured for:', process.env.CLOUDINARY_CLOUD_NAME);

// Setup multer (memory storage)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Hanya file gambar yang diperbolehkan'));
    }
  }
});

// ==================== UPLOAD DOKUMENTASI ====================
router.post('/upload', authMiddleware, upload.single('foto'), async (req, res) => {
  try {
    const { lahan_id, lahan_nama, keterangan } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'File foto harus diupload', success: false });
    }

    if (!lahan_id) {
      return res.status(400).json({ error: 'Lahan ID harus diisi', success: false });
    }

    // Upload ke Cloudinary
    const base64String = req.file.buffer.toString('base64');
    const dataUri = `data:${req.file.mimetype};base64,${base64String}`;
    
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: 'smartfarm/dokumentasi',
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      transformation: [{ width: 1024, height: 1024, crop: 'limit' }]
    });

    const cloudinaryUrl = result.secure_url;
    const publicId = result.public_id;

    // Simpan ke database
    const dbResult = await db.query(
      `INSERT INTO dokumentasi (user_id, lahan_id, lahan_nama, cloudinary_url, public_id, keterangan, tanggal) 
       VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
      [req.user.uid, lahan_id, lahan_nama, cloudinaryUrl, publicId, keterangan || 'Dokumentasi Tanaman']
    );

    res.status(201).json({
      success: true,
      message: 'Dokumentasi berhasil diupload',
      data: {
        id: dbResult.rows[0].id,
        cloudinary_url: cloudinaryUrl,
        lahan_id,
        lahan_nama
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// ==================== GET DOKUMENTASI PETANI ====================
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, lahan_id, lahan_nama, cloudinary_url, keterangan, tanggal 
       FROM dokumentasi 
       WHERE user_id = $1 
       ORDER BY tanggal DESC`,
      [req.user.uid]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// ==================== UPDATE KETERANGAN ====================
router.put('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { keterangan } = req.body;

  try {
    const result = await db.query(
      `UPDATE dokumentasi 
       SET keterangan = $1 
       WHERE id = $2 AND user_id = $3 
       RETURNING *`,
      [keterangan, id, req.user.uid]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dokumentasi tidak ditemukan', success: false });
    }
    
    res.json({ success: true, message: 'Keterangan berhasil diupdate', data: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// ==================== HAPUS DOKUMENTASI ====================
router.delete('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const fileResult = await db.query(
      'SELECT public_id FROM dokumentasi WHERE id = $1 AND user_id = $2',
      [id, req.user.uid]
    );
    
    if (fileResult.rows.length > 0 && fileResult.rows[0].public_id) {
      await cloudinary.uploader.destroy(fileResult.rows[0].public_id);
    }
    
    await db.query('DELETE FROM dokumentasi WHERE id = $1 AND user_id = $2', [id, req.user.uid]);
    
    res.json({ success: true, message: 'Dokumentasi berhasil dihapus' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// ==================== ADMIN: GET SEMUA DOKUMENTASI ====================
router.get('/admin/all', authMiddleware, async (req, res) => {
  const userResult = await db.query('SELECT role FROM users WHERE id = $1', [req.user.uid]);
  if (userResult.rows.length === 0 || userResult.rows[0].role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden - Admin only', success: false });
  }

  try {
    const result = await db.query(
      `SELECT 
         d.id, d.lahan_id, d.lahan_nama, d.cloudinary_url, d.keterangan, d.tanggal,
         u.id as user_id, u.name as petani_name, u.email as petani_email
       FROM dokumentasi d
       JOIN users u ON d.user_id = u.id
       ORDER BY d.tanggal DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, success: false });
  }
});

module.exports = router;