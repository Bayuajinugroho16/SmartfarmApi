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

// ==================== STATISTIK dashboard admin ====================
router.get('/statistik', authMiddleware, adminOnly, async (req, res) => {
  try {
    const totalPetani = await db.query("SELECT COUNT(*) FROM users WHERE role = 'petani'");
    const totalAktif = await db.query("SELECT COUNT(*) FROM users WHERE role = 'petani' AND status = 'Aktif'");
    const totalLahan = await db.query(
      "SELECT COUNT(DISTINCT lahan) FROM users WHERE role = 'petani' AND lahan IS NOT NULL"
    );
    const totalCatatan = await db.query(
      "SELECT COUNT(*) FROM catatan c JOIN users u ON c.user_id = u.id WHERE u.role = 'petani'"
    );
    const totalJadwal = await db.query(
      "SELECT COUNT(*) FROM jadwal j JOIN users u ON j.user_id = u.id WHERE u.role = 'petani'"
    );
    
    res.json({
      success: true,
      data: {
        totalPetani: parseInt(totalPetani.rows[0].count),
        totalAktif: parseInt(totalAktif.rows[0].count),
        totalLahan: parseInt(totalLahan.rows[0].count),
        totalCatatan: parseInt(totalCatatan.rows[0].count),
        totalJadwal: parseInt(totalJadwal.rows[0].count)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, success: false });
  }
});

module.exports = router;