const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const path = require('path');  // ← TAMBAHKAN
const fs = require('fs');      // ← TAMBAHKAN

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ==================== TAMBAHKAN: Static file serving untuk uploads ====================
// Buat folder uploads jika belum ada
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ Folder uploads created');
}

// Serve static files dari folder uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
console.log('✅ Static file serving enabled: /uploads');

// Routes
const authRoutes = require('./routes/auth');
const catatanRoutes = require('./routes/catatan');
const jadwalRoutes = require('./routes/jadwal');
const userRoutes = require('./routes/user');
const dokumentasiRoutes = require('./routes/dokumentasi');
const adminRoutes = require('./routes/admin');
const notificationsRoutes = require('./routes/notifications');
const statistikRoutes = require('./routes/statistik');
const laporanRoutes = require('./routes/laporan');
const diskusiRoutes = require('./routes/diskusi');
const settingsRoutes = require('./routes/settings');
const lainnyaRoutes = require('./routes/lainnya');
const mapsRoutes = require('./routes/maps');

app.use('/api/auth', authRoutes);
app.use('/api/catatan', catatanRoutes);
app.use('/api/jadwal', jadwalRoutes);
app.use('/api/user', userRoutes);
app.use('/api/dokumentasi', dokumentasiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/statistik', statistikRoutes);
app.use('/api/laporan', laporanRoutes);
app.use('/api/diskusi', diskusiRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api', lainnyaRoutes);
app.use('/api/maps', mapsRoutes);

// ==================== BROADCAST (PAKAI JWT, BUKAN FIREBASE) ====================
app.post('/api/admin/broadcast', async (req, res) => {
  const { title, message, targetUserId } = req.body;
  const token = req.headers.authorization?.split('Bearer ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token tidak ditemukan', success: false });
  }

  try {
    // Verifikasi token JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.uid;
    
    // Cek role admin dari database
    const db = require('./config/db');
    const userResult = await db.query('SELECT role FROM users WHERE id = $1', [userId]);
    
    if (userResult.rows.length === 0 || userResult.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden - Admin only', success: false });
    }

    if (!title || !message) {
      return res.status(400).json({ error: 'Judul dan pesan harus diisi', success: false });
    }
    
    if (targetUserId) {
      // Kirim ke petani tertentu
      const user = await db.query('SELECT id FROM users WHERE id = $1 AND role = $2', [targetUserId, 'petani']);
      if (user.rows.length === 0) {
        return res.status(404).json({ error: 'Petani tidak ditemukan', success: false });
      }

      await db.query(
        `INSERT INTO notifications (user_id, title, body, type, is_read, created_at) 
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [targetUserId, title, message, 'broadcast', false]
      );
      
      res.json({ success: true, message: 'Notifikasi terkirim ke petani' });
    } else {
      // Kirim ke SEMUA petani aktif
      const users = await db.query("SELECT id FROM users WHERE role = 'petani' AND status = 'Aktif'");
      
      for (const user of users.rows) {
        await db.query(
          `INSERT INTO notifications (user_id, title, body, type, is_read, created_at) 
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [user.id, title, message, 'broadcast', false]
        );
      }
      
      res.json({ 
        success: true, 
        message: `Broadcast terkirim ke ${users.rows.length} petani aktif` 
      });
    }
  } catch (error) {
    console.error('Broadcast error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token tidak valid', success: false });
    }
    res.status(500).json({ error: error.message, success: false });
  }
});

app.get('/api', (req, res) => {
  res.json({ message: 'SMARTFARM API is running' });
});

app.get('/', (req, res) => {
  res.json({ message: 'SMARTFARM API is running' });
});

module.exports = app;