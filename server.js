const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
// HAPUS: const path = require('path');
// HAPUS: const fs = require('fs');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ==================== INIT FIREBASE ADMIN ====================
// Inisialisasi Firebase Admin untuk FCM Push Notification
try {
  // Cek apakah sudah diinisialisasi
  if (!admin.apps.length) {
    // Untuk Vercel, gunakan environment variable
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      // Untuk local development
      const serviceAccount = require('./serviceAccountKey.json');
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    console.log('✅ Firebase Admin initialized');
  }
} catch (error) {
  console.error('❌ Firebase Admin init error:', error.message);
}

// ==================== HAPUS STATIC FILE SERVING UNTUK UPLOADS ====================
// Di Vercel serverless, TIDAK BISA membuat folder uploads
// Gunakan Cloudinary untuk upload file

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

// ==================== BROADCAST (PAKAI JWT + FCM) ====================
app.post('/api/admin/broadcast', async (req, res) => {
  const { title, message, targetUserId } = req.body;
  const token = req.headers.authorization?.split('Bearer ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token tidak ditemukan', success: false });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.uid;
    
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
      const petani = await db.query('SELECT id, fcm_token FROM users WHERE id = $1 AND role = $2', [targetUserId, 'petani']);
      if (petani.rows.length === 0) {
        return res.status(404).json({ error: 'Petani tidak ditemukan', success: false });
      }

      // Simpan ke database
      await db.query(
        `INSERT INTO notifications (user_id, title, body, type, is_read, created_at) 
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [targetUserId, title, message, 'broadcast', false]
      );
      
      // Kirim FCM push notification jika ada token
      const fcmToken = petani.rows[0].fcm_token;
      if (fcmToken && admin.apps.length > 0) {
        try {
          await admin.messaging().send({
            token: fcmToken,
            notification: {
              title: title,
              body: message,
            },
            android: { priority: 'high' },
          });
          console.log('✅ FCM sent to:', targetUserId);
        } catch (fcmError) {
          console.error('FCM error:', fcmError.message);
        }
      }
      
      res.json({ success: true, message: 'Notifikasi terkirim ke petani' });
    } else {
      // Kirim ke SEMUA petani aktif
      const users = await db.query("SELECT id, fcm_token FROM users WHERE role = 'petani' AND status = 'Aktif'");
      
      // Simpan ke database
      for (const user of users.rows) {
        await db.query(
          `INSERT INTO notifications (user_id, title, body, type, is_read, created_at) 
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [user.id, title, message, 'broadcast', false]
        );
      }
      
      // Kirim FCM ke yang punya token
      const tokens = users.rows.map(u => u.fcm_token).filter(t => t && t.length > 0);
      if (tokens.length > 0 && admin.apps.length > 0) {
        try {
          // Kirim multicast (maks 500 token per call)
          for (let i = 0; i < tokens.length; i += 500) {
            const batch = tokens.slice(i, i + 500);
            await admin.messaging().sendEachForMulticast({
              tokens: batch,
              notification: {
                title: title,
                body: message,
              },
            });
          }
          console.log(`✅ FCM sent to ${tokens.length} devices`);
        } catch (fcmError) {
          console.error('FCM broadcast error:', fcmError.message);
        }
      }
      
      res.json({ 
        success: true, 
        message: `Broadcast terkirim ke ${users.rows.length} petani` 
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