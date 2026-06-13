const express = require('express');
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Middleware untuk cek role admin
const adminOnly = async (req, res, next) => {
  const user = req.user;
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden', success: false });
  }
  next();
};

// ==================== GET semua petani ====================
router.get('/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, name, email, status, lahan, created_at FROM users WHERE role = 'petani' ORDER BY created_at DESC"
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

// ==================== GET catatan petani tertentu ====================
router.get('/users/:id/catatan', authMiddleware, adminOnly, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      'SELECT * FROM catatan WHERE user_id = $1 ORDER BY tanggal DESC',
      [id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

// ==================== GET jadwal petani tertentu ====================
router.get('/users/:id/jadwal', authMiddleware, adminOnly, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      'SELECT * FROM jadwal WHERE user_id = $1 ORDER BY tanggal ASC',
      [id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

// ==================== UPDATE petani (Edit) ====================
router.put('/users/:id', authMiddleware, adminOnly, async (req, res) => {
  const { id } = req.params;
  const { name, email, lahan, status } = req.body;

  if (!name && !email && !lahan && !status) {
    return res.status(400).json({ error: 'Tidak ada数据 yang diupdate', success: false });
  }

  try {
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (email) {
      updates.push(`email = $${paramIndex++}`);
      values.push(email);
    }
    if (lahan) {
      updates.push(`lahan = $${paramIndex++}`);
      values.push(lahan);
    }
    if (status) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }

    values.push(id);
    
    await db.query(
      `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex}`,
      values
    );
    
    res.json({ success: true, message: 'User berhasil diupdate' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// ==================== DELETE petani (Hapus) ====================
router.delete('/users/:id', authMiddleware, adminOnly, async (req, res) => {
  const { id } = req.params;

  try {
    const user = await db.query('SELECT id, name FROM users WHERE id = $1 AND role = $2', [id, 'petani']);
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'Petani tidak ditemukan', success: false });
    }

    await db.query('DELETE FROM users WHERE id = $1', [id]);
    
    res.json({ 
      success: true, 
      message: `Petani ${user.rows[0].name} berhasil dihapus` 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// ==================== RESET PASSWORD petani ====================
const bcrypt = require('bcryptjs');

router.post('/users/:id/reset-password', authMiddleware, adminOnly, async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ 
      error: 'Password minimal 6 karakter', 
      success: false 
    });
  }

  try {
    const user = await db.query('SELECT id, name FROM users WHERE id = $1 AND role = $2', [id, 'petani']);
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'Petani tidak ditemukan', success: false });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, id]);
    
    res.json({ 
      success: true, 
      message: `Password berhasil direset untuk ${user.rows[0].name}` 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// routes/admin.js - Tambahkan ini

// ==================== STATISTIK DASHBOARD ADMIN ====================
router.get('/statistik', authMiddleware, adminOnly, async (req, res) => {
  try {
    // Total petani
    const totalPetani = await db.query("SELECT COUNT(*) FROM users WHERE role = 'petani'");
    
    // Petani aktif vs nonaktif
    const petaniAktif = await db.query("SELECT COUNT(*) FROM users WHERE role = 'petani' AND status = 'Aktif'");
    const petaniNonaktif = await db.query("SELECT COUNT(*) FROM users WHERE role = 'petani' AND status != 'Aktif'");
    
    // Total catatan semua petani
    const totalCatatan = await db.query("SELECT COUNT(*) FROM catatan");
    
    // Total jadwal semua petani
    const totalJadwal = await db.query("SELECT COUNT(*) FROM jadwal");
    
    // Total dokumentasi semua petani
    const totalDokumentasi = await db.query("SELECT COUNT(*) FROM dokumentasi");
    
    // Total diskusi
    const totalDiskusi = await db.query("SELECT COUNT(*) FROM diskusi");
    
    // Total notifikasi 7 hari terakhir
    const notifikasi7Hari = await db.query(
      "SELECT COUNT(*) FROM notifications WHERE created_at > NOW() - INTERVAL '7 days'"
    );
    
    // Statistik per bulan (6 bulan terakhir)
    const bulanan = await db.query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', tanggal), 'YYYY-MM') as bulan,
        COUNT(*) as total
      FROM catatan
      WHERE tanggal > NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', tanggal)
      ORDER BY bulan ASC
    `);
    
    // Top 5 petani dengan catatan terbanyak
    const topPetani = await db.query(`
      SELECT 
        u.id, u.name, u.email,
        COUNT(c.id) as jumlah_catatan
      FROM users u
      LEFT JOIN catatan c ON u.id = c.user_id
      WHERE u.role = 'petani'
      GROUP BY u.id
      ORDER BY jumlah_catatan DESC
      LIMIT 5
    `);
    
    res.json({
      success: true,
      data: {
        total_petani: parseInt(totalPetani.rows[0].count),
        petani_aktif: parseInt(petaniAktif.rows[0].count),
        petani_nonaktif: parseInt(petaniNonaktif.rows[0].count),
        total_catatan: parseInt(totalCatatan.rows[0].count),
        total_jadwal: parseInt(totalJadwal.rows[0].count),
        total_dokumentasi: parseInt(totalDokumentasi.rows[0].count),
        total_diskusi: parseInt(totalDiskusi.rows[0].count),
        notifikasi_7_hari: parseInt(notifikasi7Hari.rows[0].count),
        statistik_bulanan: bulanan.rows,
        top_petani: topPetani.rows,
      }
    });
  } catch (error) {
    console.error('Statistik error:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// ==================== STATISTIK DETAIL (Grafik & Top Petani) ====================
router.get('/statistik-detail', authMiddleware, adminOnly, async (req, res) => {
  try {
    // Total petani
    const totalPetani = await db.query("SELECT COUNT(*) FROM users WHERE role = 'petani'");
    const petaniAktif = await db.query("SELECT COUNT(*) FROM users WHERE role = 'petani' AND status = 'Aktif'");
    const petaniNonaktif = await db.query("SELECT COUNT(*) FROM users WHERE role = 'petani' AND status != 'Aktif'");
    
    // Total catatan semua petani
    const totalCatatan = await db.query(
      "SELECT COUNT(*) FROM catatan c JOIN users u ON c.user_id = u.id WHERE u.role = 'petani'"
    );
    
    // Total jadwal semua petani
    const totalJadwal = await db.query(
      "SELECT COUNT(*) FROM jadwal j JOIN users u ON j.user_id = u.id WHERE u.role = 'petani'"
    );
    
    // Total dokumentasi semua petani
    const totalDokumentasi = await db.query('SELECT COUNT(*) FROM dokumentasi');
    
    // Total diskusi
    const totalDiskusi = await db.query('SELECT COUNT(*) FROM diskusi');
    
    // Total notifikasi terkirim (7 hari terakhir)
    const notifikasi7Hari = await db.query(
      `SELECT COUNT(*) FROM notifications WHERE created_at > NOW() - INTERVAL '7 days'`
    );
    
    // Statistik per bulan (6 bulan terakhir) dari catatan
    const bulanan = await db.query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', tanggal), 'YYYY-MM') as bulan,
        COUNT(*) as total
      FROM catatan
      WHERE tanggal > NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', tanggal)
      ORDER BY bulan ASC
    `);
    
    // Top petani dengan catatan terbanyak
    const topPetani = await db.query(`
      SELECT 
        u.id, u.name, u.email,
        COUNT(c.id) as jumlah_catatan
      FROM users u
      LEFT JOIN catatan c ON u.id = c.user_id
      WHERE u.role = 'petani'
      GROUP BY u.id
      ORDER BY jumlah_catatan DESC
      LIMIT 5
    `);
    
    res.json({
      success: true,
      data: {
        total_petani: parseInt(totalPetani.rows[0].count),
        petani_aktif: parseInt(petaniAktif.rows[0].count),
        petani_nonaktif: parseInt(petaniNonaktif.rows[0].count),
        total_catatan: parseInt(totalCatatan.rows[0].count),
        total_jadwal: parseInt(totalJadwal.rows[0].count),
        total_dokumentasi: parseInt(totalDokumentasi.rows[0].count),
        total_diskusi: parseInt(totalDiskusi.rows[0].count),
        notifikasi_7_hari: parseInt(notifikasi7Hari.rows[0].count),
        statistik_bulanan: bulanan.rows,
        top_petani: topPetani.rows,
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, success: false });
  }
});

module.exports = router;