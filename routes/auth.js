const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const router = express.Router();

// REGISTER
router.post('/register', async (req, res) => {
  const { name, email, password, lahan = 'Lahan Cabai' } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Semua field harus diisi', success: false });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password minimal 6 karakter', success: false });
  }

  try {
    // Cek email sudah terdaftar
    const existing = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email sudah terdaftar', success: false });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Simpan user
    const result = await db.query(
      `INSERT INTO users (name, email, password, role, lahan, status) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role`,
      [name, email, hashedPassword, 'petani', lahan, 'Aktif']
    );

    const user = result.rows[0];

    // Buat token
    const token = jwt.sign(
      { uid: user.id, email: user.email, name: user.name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Registrasi berhasil',
      data: { uid: user.id, email: user.email, name: user.name, role: user.role, token }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error', success: false });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email dan password harus diisi', success: false });
  }

  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Email atau password salah', success: false });
    }

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return res.status(401).json({ error: 'Email atau password salah', success: false });
    }

    const token = jwt.sign(
      { uid: user.id, email: user.email, name: user.name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login berhasil',
      data: { uid: user.id, email: user.email, name: user.name, role: user.role, token }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error', success: false });
  }
});

module.exports = router;