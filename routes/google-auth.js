const express = require('express');
const router = express.Router();
const GoogleCredentials = require('../models/GoogleCredentials');

// POST /api/google-auth/credentials - Recibir y almacenar credenciales de Google
router.post('/credentials', async (req, res) => {
  try {
    const { access_token, refresh_token, token_type, scope, expiry_date } = req.body;

    // Validar que se reciban los campos requeridos
    if (!access_token || !refresh_token || !scope || !expiry_date) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos: access_token, refresh_token, scope, expiry_date'
      });
    }

    // Actualizar o crear las credenciales del sistema
    const credentials = await GoogleCredentials.updateSystemCredentials({
      access_token,
      refresh_token,
      token_type: token_type || 'Bearer',
      scope,
      expiry_date
    });

    console.log('✅ Credenciales de Google actualizadas correctamente');

    res.json({
      success: true,
      message: 'Credenciales de Google almacenadas correctamente',
      data: {
        id: credentials._id,
        expiry_date: credentials.expiry_date,
        scope: credentials.scope,
        created_at: credentials.createdAt,
        updated_at: credentials.updatedAt
      }
    });

  } catch (error) {
    console.error('❌ Error al almacenar credenciales de Google:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

// GET /api/google-auth/status - Verificar estado de las credenciales
router.get('/status', async (req, res) => {
  try {
    const credentials = await GoogleCredentials.getSystemCredentials();

    if (!credentials) {
      return res.json({
        success: true,
        configured: false,
        message: 'No hay credenciales de Google configuradas'
      });
    }

    const isExpired = credentials.isExpired();

    res.json({
      success: true,
      configured: true,
      data: {
        id: credentials._id,
        scope: credentials.scope,
        expiry_date: credentials.expiry_date,
        is_expired: isExpired,
        last_used: credentials.last_used,
        created_at: credentials.createdAt,
        updated_at: credentials.updatedAt
      }
    });

  } catch (error) {
    console.error('❌ Error al verificar estado de credenciales:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

// DELETE /api/google-auth/credentials - Eliminar credenciales almacenadas
router.delete('/credentials', async (req, res) => {
  try {
    const credentials = await GoogleCredentials.findOne({ identifier: 'system' });

    if (!credentials) {
      return res.status(404).json({
        success: false,
        message: 'No se encontraron credenciales para eliminar'
      });
    }

    await GoogleCredentials.deleteOne({ identifier: 'system' });

    console.log('✅ Credenciales de Google eliminadas correctamente');

    res.json({
      success: true,
      message: 'Credenciales de Google eliminadas correctamente'
    });

  } catch (error) {
    console.error('❌ Error al eliminar credenciales de Google:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

module.exports = router;

