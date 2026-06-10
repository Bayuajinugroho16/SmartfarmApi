const express = require('express');
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// GET statistik pribadi petani
router.get('/petani', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.uid;
    
    const totalCatatan = await db.query('SELECT COUNT(*) FROM catatan WHERE user_id = $1', [userId]);
    const totalJadwal = await db.query('SELECT COUNT(*) FROM jadwal WHERE user_id = $1', [userId]);
    const jadwalSelesai = await db.query('SELECT COUNT(*) FROM jadwal WHERE user_id = $1 AND status = $2', [userId, 'Selesai']);
    const jadwalBelum = await db.query('SELECT COUNT(*) FROM jadwal WHERE user_id = $1 AND status = $2', [userId, 'Belum']);
    const aktivitas7hari = await db.query(
      `SELECT DATE(tanggal) as tanggal, COUNT(*) as total 
       FROM catatan 
       WHERE user_id = $1 AND tanggal >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY DATE(tanggal) 
       ORDER BY tanggal DESC`,
      [userId]
    );
    
    res.json({
      success: true,
      data: {
        totalCatatan: parseInt(totalCatatan.rows[0].count),
        totalJadwal: parseInt(totalJadwal.rows[0].count),
        jadwalSelesai: parseInt(jadwalSelesai.rows[0].count),
        jadwalBelum: parseInt(jadwalBelum.rows[0].count),
        aktivitas7hari: aktivitas7hari.rows
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

// GET grafik aktivitas per bulan
router.get('/petani/bulanan', authMiddleware, async (req, res) => {
  const { year = new Date().getFullYear() } = req.query;
  const userId = req.user.uid;
  
  try {
    const result = await db.query(
      `SELECT EXTRACT(MONTH FROM tanggal) as bulan, COUNT(*) as total 
       FROM catatan 
       WHERE user_id = $1 AND EXTRACT(YEAR FROM tanggal) = $2
       GROUP BY EXTRACT(MONTH FROM tanggal)
       ORDER BY bulan ASC`,
      [userId, year]
    );
    
    const monthlyData = Array(12).fill(0);
    for (const row of result.rows) {
      monthlyData[parseInt(row.bulan) - 1] = parseInt(row.total);
    }
    
    res.json({
      success: true,
      data: {
        tahun: year,
        data: monthlyData,
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

// GET grafik aktivitas per tahun
router.get('/petani/tahunan', authMiddleware, async (req, res) => {
  const userId = req.user.uid;
  
  try {
    const result = await db.query(
      `SELECT EXTRACT(YEAR FROM tanggal) as tahun, COUNT(*) as total 
       FROM catatan 
       WHERE user_id = $1
       GROUP BY EXTRACT(YEAR FROM tanggal)
       ORDER BY tahun ASC`,
      [userId]
    );
    
    res.json({
      success: true,
      data: result.rows.map(row => ({
        tahun: parseInt(row.tahun),
        total: parseInt(row.total)
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

module.exports = router;