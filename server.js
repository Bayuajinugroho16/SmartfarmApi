const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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
const broadcastRoutes = require('./routes/broadcast');

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
app.use('/api/admin/broadcast', broadcastRoutes);


app.get('/api', (req, res) => {
  res.json({ message: 'SMARTFARM API is running' });
});

app.get('/', (req, res) => {
  res.json({ message: 'SMARTFARM API is running' });
});
// BROADCAST notifikasi (tambahkan di sini)
app.post('/api/admin/broadcast', async (req, res) => {
  const { title, message, targetUserId } = req.body;
  const token = req.headers.authorization?.split('Bearer ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token tidak ditemukan', success: false });
  }

  try {
    // Verifikasi token dan dapatkan user
    const admin = await admin.auth().verifyIdToken(token);
    
    // Cek role admin
    if (admin.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden', success: false });
    }

    if (!title || !message) {
      return res.status(400).json({ error: 'Judul dan pesan harus diisi', success: false });
    }

    const db = require('./config/db');
    
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
      // Kirim ke SEMUA petani
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
    console.error(error);
    res.status(500).json({ error: error.message, success: false });
  }
});
// Untuk Vercel serverless
module.exports = app;