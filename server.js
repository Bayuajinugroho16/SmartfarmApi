const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ==================== INIT FIREBASE ADMIN ====================
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
let firebaseInitialized = false;

// Inisialisasi Firebase Admin dari file serviceAccountKey.json
try {
  const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
  
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('✅ Firebase Admin initialized from file');
      firebaseInitialized = true;
    } else {
      console.log('✅ Firebase Admin already initialized');
      firebaseInitialized = true;
    }
  } else {
    console.log('⚠️ serviceAccountKey.json not found, trying env var...');
    
    // Fallback ke environment variable
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        console.log('✅ Firebase Admin initialized from env var');
        firebaseInitialized = true;
      }
    }
  }
} catch (error) {
  console.error('❌ Firebase Admin init error:', error.message);
}

if (!firebaseInitialized) {
  console.error('❌ Firebase Admin failed to initialize!');
}

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

// ==================== BROADCAST ENDPOINT ====================
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
    
    // Cek Firebase siap
    if (!firebaseInitialized) {
      console.error('⚠️ Firebase not initialized, FCM push disabled');
    }
    
    // ========== KIRIM KE PETANI TERTENTU ==========
    if (targetUserId) {
      const petani = await db.query('SELECT id, name, fcm_token FROM users WHERE id = $1 AND role = $2', [targetUserId, 'petani']);
      if (petani.rows.length === 0) {
        return res.status(404).json({ error: 'Petani tidak ditemukan', success: false });
      }

      await db.query(
        `INSERT INTO notifications (user_id, title, body, type, is_read, created_at) 
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [targetUserId, title, message, 'broadcast', false]
      );
      
      const fcmToken = petani.rows[0].fcm_token;
      if (fcmToken && fcmToken.length > 30 && firebaseInitialized) {
        try {
          await admin.messaging().send({
            token: fcmToken,
            notification: { title: title, body: message },
            android: { priority: 'high' },
          });
          console.log(`✅ FCM sent to ${petani.rows[0].name} (${targetUserId})`);
        } catch (fcmError) {
          console.error('FCM error:', fcmError.message);
        }
      } else if (!firebaseInitialized) {
        console.log('⚠️ FCM skipped: Firebase not initialized');
      }
      
      res.json({ success: true, message: 'Notifikasi terkirim ke petani' });
      return;
    }
    
    // ========== KIRIM KE SEMUA PETANI ==========
    const users = await db.query("SELECT id, name, fcm_token FROM users WHERE role = 'petani' AND status = 'Aktif'");
    const petaniList = users.rows || [];
    
    if (petaniList.length === 0) {
      return res.status(404).json({ error: 'Tidak ada petani aktif', success: false });
    }
    
    // Simpan ke database
    for (const user of petaniList) {
      await db.query(
        `INSERT INTO notifications (user_id, title, body, type, is_read, created_at) 
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [user.id, title, message, 'broadcast', false]
      );
    }
    
    // Kirim FCM
    let fcmSentCount = 0;
    if (firebaseInitialized) {
      for (const user of petaniList) {
        const fcmToken = user.fcm_token;
        if (fcmToken && fcmToken.length > 30) {
          try {
            await admin.messaging().send({
              token: fcmToken,
              notification: { title: title, body: message },
              android: { priority: 'high' },
            });
            fcmSentCount++;
            console.log(`✅ FCM sent to ${user.name} (${user.id})`);
          } catch (e) {
            console.error(`❌ FCM failed for ${user.name}:`, e.message);
          }
        } else {
          console.log(`⚠️ No valid token for ${user.name} (${user.id})`);
        }
      }
    } else {
      console.log('⚠️ Firebase not initialized, FCM push skipped');
    }
    
    console.log(`✅ Broadcast: ${petaniList.length} notif saved, ${fcmSentCount} FCM sent`);
    
    res.json({ 
      success: true, 
      message: `Broadcast terkirim ke ${petaniList.length} petani (${fcmSentCount} via FCM)` 
    });
    
  } catch (error) {
    console.error('Broadcast error:', error);
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