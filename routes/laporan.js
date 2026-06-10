const express = require('express');
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const router = express.Router();

// Helper untuk cek role admin
const isAdmin = async (userId) => {
  const result = await db.query('SELECT role FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.role === 'admin';
};

// GET export catatan ke PDF
router.get('/catatan/pdf', authMiddleware, async (req, res) => {
  const userId = req.user.uid;
  const isAdminUser = await isAdmin(userId);
  
  try {
    let catatan;
    if (isAdminUser && req.query.user_id) {
      catatan = await db.query(
        'SELECT c.*, u.name as user_name FROM catatan c JOIN users u ON c.user_id = u.id WHERE c.user_id = $1 ORDER BY c.tanggal DESC',
        [req.query.user_id]
      );
    } else {
      catatan = await db.query(
        'SELECT * FROM catatan WHERE user_id = $1 ORDER BY tanggal DESC',
        [userId]
      );
    }
    
    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=laporan_catatan.pdf');
    doc.pipe(res);
    
    doc.fontSize(20).text('Laporan Catatan Aktivitas', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Tanggal: ${new Date().toLocaleDateString('id-ID')}`);
    doc.moveDown();
    
    for (const row of catatan.rows) {
      doc.fontSize(12).text(`📝 ${row.judul}`, { underline: true });
      doc.fontSize(10).text(`Tanggal: ${row.tanggal}`);
      doc.fontSize(10).text(`Deskripsi: ${row.deskripsi}`);
      if (isAdminUser && req.query.user_id) {
        doc.fontSize(10).text(`Petani: ${row.user_name}`);
      }
      doc.moveDown();
    }
    
    doc.end();
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

// GET export catatan ke Excel
router.get('/catatan/excel', authMiddleware, async (req, res) => {
  const userId = req.user.uid;
  const isAdminUser = await isAdmin(userId);
  
  try {
    let catatan;
    if (isAdminUser && req.query.user_id) {
      catatan = await db.query(
        'SELECT c.*, u.name as user_name FROM catatan c JOIN users u ON c.user_id = u.id WHERE c.user_id = $1 ORDER BY c.tanggal DESC',
        [req.query.user_id]
      );
    } else {
      catatan = await db.query(
        'SELECT * FROM catatan WHERE user_id = $1 ORDER BY tanggal DESC',
        [userId]
      );
    }
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Laporan Catatan');
    
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Judul', key: 'judul', width: 30 },
      { header: 'Deskripsi', key: 'deskripsi', width: 40 },
      { header: 'Tanggal', key: 'tanggal', width: 15 },
    ];
    
    if (isAdminUser && req.query.user_id) {
      worksheet.columns.unshift({ header: 'Petani', key: 'user_name', width: 20 });
    }
    
    for (const row of catatan.rows) {
      worksheet.addRow(row);
    }
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=laporan_catatan.xlsx');
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

// GET export jadwal ke PDF
router.get('/jadwal/pdf', authMiddleware, async (req, res) => {
  const userId = req.user.uid;
  const isAdminUser = await isAdmin(userId);
  
  try {
    let jadwal;
    if (isAdminUser && req.query.user_id) {
      jadwal = await db.query(
        'SELECT j.*, u.name as user_name FROM jadwal j JOIN users u ON j.user_id = u.id WHERE j.user_id = $1 ORDER BY j.tanggal ASC',
        [req.query.user_id]
      );
    } else {
      jadwal = await db.query(
        'SELECT * FROM jadwal WHERE user_id = $1 ORDER BY tanggal ASC',
        [userId]
      );
    }
    
    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=laporan_jadwal.pdf');
    doc.pipe(res);
    
    doc.fontSize(20).text('Laporan Jadwal Tanam & Panen', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Tanggal: ${new Date().toLocaleDateString('id-ID')}`);
    doc.moveDown();
    
    for (const row of jadwal.rows) {
      doc.fontSize(12).text(`📅 ${row.judul}`, { underline: true });
      doc.fontSize(10).text(`Tanggal: ${row.tanggal}`);
      doc.fontSize(10).text(`Status: ${row.status === 'Selesai' ? '✓ Selesai' : '○ Belum'}`);
      if (isAdminUser && req.query.user_id) {
        doc.fontSize(10).text(`Petani: ${row.user_name}`);
      }
      doc.moveDown();
    }
    
    doc.end();
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

// GET export jadwal ke Excel
router.get('/jadwal/excel', authMiddleware, async (req, res) => {
  const userId = req.user.uid;
  const isAdminUser = await isAdmin(userId);
  
  try {
    let jadwal;
    if (isAdminUser && req.query.user_id) {
      jadwal = await db.query(
        'SELECT j.*, u.name as user_name FROM jadwal j JOIN users u ON j.user_id = u.id WHERE j.user_id = $1 ORDER BY j.tanggal ASC',
        [req.query.user_id]
      );
    } else {
      jadwal = await db.query(
        'SELECT * FROM jadwal WHERE user_id = $1 ORDER BY tanggal ASC',
        [userId]
      );
    }
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Laporan Jadwal');
    
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Judul', key: 'judul', width: 30 },
      { header: 'Tanggal', key: 'tanggal', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
    ];
    
    if (isAdminUser && req.query.user_id) {
      worksheet.columns.unshift({ header: 'Petani', key: 'user_name', width: 20 });
    }
    
    for (const row of jadwal.rows) {
      worksheet.addRow(row);
    }
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=laporan_jadwal.xlsx');
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

// GET export semua data petani (admin only)
router.get('/semua/petani', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden', success: false });
  }
  
  try {
    const users = await db.query("SELECT id, name, email, role, status, lahan, created_at FROM users WHERE role = 'petani'");
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data Petani');
    
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Nama', key: 'name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Lahan', key: 'lahan', width: 25 },
      { header: 'Bergabung', key: 'created_at', width: 20 },
    ];
    
    for (const row of users.rows) {
      worksheet.addRow(row);
    }
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=data_petani.xlsx');
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

module.exports = router;