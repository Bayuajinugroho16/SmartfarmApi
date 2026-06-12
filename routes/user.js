const express = require('express');
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const router = express.Router();

// ==================== KONFIGURASI CLOUDINARY ====================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Setup multer (memory storage) untuk upload foto profil
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file gambar yang diperbolehkan'));
    }
  }
});

// ==================== GET PROFIL USER ====================
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, email, role, status, lahan, foto_url, created_at 
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
        foto_url: user.foto_url,
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

// ==================== UPDATE PROFIL ====================
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

// ==================== CHANGE PASSWORD ====================
router.post('/change-password', authMiddleware, async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ 
      error: 'Password lama dan baru harus diisi', 
      success: false 
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ 
      error: 'Password baru minimal 6 karakter', 
      success: false 
    });
  }

  try {
    // Ambil password lama dari database
    const user = await db.query('SELECT password FROM users WHERE id = $1', [req.user.uid]);
    
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User tidak ditemukan', success: false });
    }

    // Verifikasi password lama
    const isValid = await bcrypt.compare(oldPassword, user.rows[0].password);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Password lama salah', success: false });
    }

    // Hash password baru
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, req.user.uid]);
    
    res.json({ success: true, message: 'Password berhasil diubah' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// ==================== UPLOAD FOTO PROFIL ====================
router.post('/foto-profil', authMiddleware, upload.single('foto'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'File foto harus diupload', success: false });
    }

    // Upload ke Cloudinary
    const base64String = req.file.buffer.toString('base64');
    const dataUri = `data:${req.file.mimetype};base64,${base64String}`;
    
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: 'smartfarm/profil',
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      transformation: [{ width: 500, height: 500, crop: 'limit' }]
    });

    const cloudinaryUrl = result.secure_url;

    // Update database
    await db.query(
      'UPDATE users SET foto_url = $1 WHERE id = $2',
      [cloudinaryUrl, req.user.uid]
    );

    res.status(200).json({
      success: true,
      message: 'Foto profil berhasil diupload',
      data: { foto_url: cloudinaryUrl }
    });
  } catch (error) {
    console.error('Upload foto profil error:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// ==================== UPDATE FOTO PROFIL (URL) ====================
router.put('/foto-profil', authMiddleware, async (req, res) => {
  const { foto_url } = req.body;

  if (!foto_url) {
    return res.status(400).json({ error: 'URL foto harus diisi', success: false });
  }

  try {
    await db.query(
      'UPDATE users SET foto_url = $1 WHERE id = $2',
      [foto_url, req.user.uid]
    );

    res.json({ success: true, message: 'Foto profil berhasil diupdate' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// routes/user.js - Tambahkan di akhir
router.post('/fcm-token', authMiddleware, async (req, res) => {
  const { fcm_token } = req.body;
  
  if (!fcm_token) {
    return res.status(400).json({ error: 'FCM token harus diisi', success: false });
  }
  
  try {
    await db.query(
      'UPDATE users SET fcm_token = $1 WHERE id = $2',
      [fcm_token, req.user.uid]
    );
    res.json({ success: true, message: 'FCM token saved' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, success: false });
  }
});

module.exports = router;