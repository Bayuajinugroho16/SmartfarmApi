const express = require('express');
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');
const axios = require('axios');
const router = express.Router();

// ==================== REVERSE GEOCODE (Koordinat → Alamat) ====================
router.get('/reverse-geocode', authMiddleware, async (req, res) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ 
      error: 'Latitude dan longitude harus diisi', 
      success: false 
    });
  }

  try {
    // Gunakan Nominatim (OpenStreetMap) - GRATIS
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
    );

    const address = response.data;
    
    res.json({
      success: true,
      data: {
        full_address: address.display_name || '-',
        village: address.address?.village || address.address?.suburb || '-',
        district: address.address?.county || address.address?.city_district || '-',
        city: address.address?.city || address.address?.town || '-',
        province: address.address?.state || '-',
        country: address.address?.country || '-',
        postal_code: address.address?.postcode || '-',
      }
    });
  } catch (error) {
    console.error('Reverse geocode error:', error.message);
    res.status(500).json({ 
      error: 'Gagal reverse geocode', 
      success: false 
    });
  }
});

// ==================== FORWARD GEOCODE (Alamat → Koordinat) ====================
router.get('/geocode', authMiddleware, async (req, res) => {
  const { address } = req.query;

  if (!address) {
    return res.status(400).json({ 
      error: 'Alamat harus diisi', 
      success: false 
    });
  }

  try {
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
    );

    if (response.data && response.data.length > 0) {
      const location = response.data[0];
      res.json({
        success: true,
        data: {
          lat: parseFloat(location.lat),
          lng: parseFloat(location.lon),
          display_name: location.display_name,
        }
      });
    } else {
      res.json({
        success: false,
        error: 'Lokasi tidak ditemukan',
        data: null
      });
    }
  } catch (error) {
    console.error('Geocode error:', error.message);
    res.status(500).json({ 
      error: 'Gagal geocode', 
      success: false 
    });
  }
});

// ==================== HITUNG JARAK (Distance Matrix) ====================
router.get('/distance', authMiddleware, async (req, res) => {
  const { from_lat, from_lng, to_lat, to_lng } = req.query;

  if (!from_lat || !from_lng || !to_lat || !to_lng) {
    return res.status(400).json({ 
      error: 'Parameter tidak lengkap', 
      success: false 
    });
  }

  try {
    // Hitung jarak menggunakan rumus Haversine
    const distance = calculateDistance(
      parseFloat(from_lat), 
      parseFloat(from_lng),
      parseFloat(to_lat), 
      parseFloat(to_lng)
    );

    // Estimasi waktu (asumsi kecepatan rata-rata 40 km/jam)
    const durationHours = distance / 40;
    const durationMinutes = Math.round(durationHours * 60);
    const durationText = durationMinutes < 60 
      ? `${durationMinutes} menit` 
      : `${Math.floor(durationMinutes / 60)} jam ${durationMinutes % 60} menit`;

    res.json({
      success: true,
      data: {
        distance_km: parseFloat(distance.toFixed(2)),
        distance_meters: Math.round(distance * 1000),
        duration_minutes: durationMinutes,
        duration_text: durationText,
        from: { lat: from_lat, lng: from_lng },
        to: { lat: to_lat, lng: to_lng }
      }
    });
  } catch (error) {
    console.error('Distance error:', error.message);
    res.status(500).json({ 
      error: 'Gagal menghitung jarak', 
      success: false 
    });
  }
});

// Rumus Haversine untuk hitung jarak (meter)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radius bumi dalam meter
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// ==================== SIMPAN LOKASI LAHAN ====================
router.post('/lokasi', authMiddleware, async (req, res) => {
  const { lahan_id, latitude, longitude, nama_lokasi, deskripsi } = req.body;

  if (!lahan_id || !latitude || !longitude) {
    return res.status(400).json({ 
      error: 'Lahan ID, latitude, dan longitude harus diisi', 
      success: false 
    });
  }

  try {
    // Cek apakah sudah ada data lokasi untuk lahan ini
    const existing = await db.query(
      'SELECT id FROM lokasi_lahan WHERE lahan_id = $1 AND user_id = $2',
      [lahan_id, req.user.uid]
    );

    if (existing.rows.length > 0) {
      // Update existing
      await db.query(
        `UPDATE lokasi_lahan 
         SET latitude = $1, longitude = $2, nama_lokasi = $3, deskripsi = $4, updated_at = NOW() 
         WHERE lahan_id = $5 AND user_id = $6`,
        [latitude, longitude, nama_lokasi || '', deskripsi || '', lahan_id, req.user.uid]
      );
      res.json({ 
        success: true, 
        message: 'Lokasi lahan berhasil diupdate' 
      });
    } else {
      // Insert new
      await db.query(
        `INSERT INTO lokasi_lahan (user_id, lahan_id, latitude, longitude, nama_lokasi, deskripsi, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [req.user.uid, lahan_id, latitude, longitude, nama_lokasi || '', deskripsi || '']
      );
      res.status(201).json({ 
        success: true, 
        message: 'Lokasi lahan berhasil disimpan' 
      });
    }
  } catch (error) {
    console.error('Save location error:', error.message);
    res.status(500).json({ 
      error: 'Gagal menyimpan lokasi lahan', 
      success: false 
    });
  }
});

// ==================== GET LOKASI LAHAN ====================
router.get('/lokasi/:lahan_id', authMiddleware, async (req, res) => {
  const { lahan_id } = req.params;

  try {
    const result = await db.query(
      'SELECT * FROM lokasi_lahan WHERE lahan_id = $1 AND user_id = $2',
      [lahan_id, req.user.uid]
    );

    if (result.rows.length > 0) {
      res.json({ 
        success: true, 
        data: result.rows[0] 
      });
    } else {
      res.json({ 
        success: true, 
        data: null,
        message: 'Belum ada lokasi untuk lahan ini'
      });
    }
  } catch (error) {
    console.error('Get location error:', error.message);
    res.status(500).json({ 
      error: 'Gagal mengambil lokasi lahan', 
      success: false 
    });
  }
});

// ==================== GET SEMUA LOKASI LAHAN (UNTUK ADMIN) ====================
router.get('/lokasi/admin/all', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden', success: false });
  }

  try {
    const result = await db.query(
      `SELECT l.*, u.name as petani_name, u.email as petani_email 
       FROM lokasi_lahan l 
       JOIN users u ON l.user_id = u.id 
       ORDER BY l.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get all locations error:', error.message);
    res.status(500).json({ 
      error: 'Gagal mengambil semua lokasi', 
      success: false 
    });
  }
});

module.exports = router;