// BROADCAST notifikasi (di server.js)
app.post('/api/admin/broadcast', authMiddleware, async (req, res) => {
  const { title, message, targetUserId } = req.body;
  
  // Cek role admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden', success: false });
  }

  if (!title || !message) {
    return res.status(400).json({ 
      error: 'Judul dan pesan harus diisi', 
      success: false 
    });
  }

  try {
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
      const users = await db.query("SELECT id FROM users WHERE role = 'petani'");
      
      for (const user of users.rows) {
        await db.query(
          `INSERT INTO notifications (user_id, title, body, type, is_read, created_at) 
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [user.id, title, message, 'broadcast', false]
        );
      }
      
      res.json({ 
        success: true, 
        message: `Broadcast terkirim ke ${users.rows.length} petani` 
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, success: false });
  }
});