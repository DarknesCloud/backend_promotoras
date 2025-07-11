require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');

const app = express();

// Conectar a la base de datos
connectDB();

// Middleware
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rutas principales
app.use("/api/users", require("./routes/users"));
app.use("/api/schedule-config", require("./routes/scheduleConfig"));
app.use("/api/invitation", require("./routes/invitation"));

// Nuevas rutas para el sistema de cupos v2.0
app.use("/api/slots", require("./routes/slots"));
app.use("/api/attendance", require("./routes/attendance"));
app.use("/api/approval", require("./routes/approval"));
app.use("/api/initialize-slots", require("./routes/initialize"));

// Nueva ruta para CRUD de citas
app.use("/api/appointments", require("./routes/appointments"));

// Nueva ruta para manejo de credenciales de Google
app.use("/api/google-auth", require("./routes/google-auth"));

// Ruta de prueba y estado
app.get('/', (req, res) => {
  res.json({
    message: 'API Backend Promotoras funcionando correctamente',
    version: '2.0.0',
    features: [
      'Gestión de cupos por horarios configurables',
      'Control de asistencias con filtros',
      'Sistema de aprobación masiva',
      'Enlaces de Meet automáticos por cupo',
      'Configuración persistente de horarios',
      'Inicialización automática del sistema'
    ],
    endpoints: {
      users: '/api/users',
      scheduleConfig: '/api/schedule-config',
      slots: '/api/slots',
      attendance: '/api/attendance',
      approval: '/api/approval',
      initialize: '/api/initialize-slots'
    },
    timestamp: new Date().toISOString()
  });
});

// Ruta de salud del sistema
app.get('/api/health', async (req, res) => {
  try {
    const ScheduleConfig = require('./models/ScheduleConfig');
    const Slot = require('./models/Slot');
    const User = require('./models/User');
    
    // Verificar conexión a BD y obtener estadísticas básicas
    const activeConfig = await ScheduleConfig.getActiveConfig();
    const totalSlots = await Slot.countDocuments();
    const totalUsers = await User.countDocuments();
    
    res.json({
      status: 'healthy',
      database: 'connected',
      activeConfig: activeConfig ? activeConfig.name : 'No configurado',
      statistics: {
        totalSlots,
        totalUsers,
        configuredTimeSlots: activeConfig ? activeConfig.timeSlots.length : 0
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Middleware de inicialización automática
app.use(async (req, res, next) => {
  // Solo ejecutar en la primera petición a rutas de slots
  if (req.path.startsWith('/api/slots') && req.method === 'GET') {
    try {
      const ScheduleConfig = require('./models/ScheduleConfig');
      const config = await ScheduleConfig.getActiveConfig();
      
      if (!config) {
        console.log('No se encontró configuración activa, inicializando sistema...');
        await ScheduleConfig.createDefaultConfig();
        console.log('Sistema inicializado automáticamente');
      }
    } catch (error) {
      console.error('Error en inicialización automática:', error);
    }
  }
  next();
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Error interno'
  });
});

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
    availableEndpoints: [
      'GET /',
      'GET /api/health',
      'GET /api/users',
      'GET /api/schedule-config',
      'GET /api/slots/available',
      'POST /api/initialize-slots'
    ]
  });
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor Backend Promotoras v2.0 corriendo en puerto ${PORT}`);
  console.log('📋 Funcionalidades disponibles:');
  console.log('   - Gestión de cupos: /api/slots');
  console.log('   - Configuración de horarios: /api/schedule-config');
  console.log('   - Control de asistencias: /api/attendance');
  console.log('   - Sistema de aprobación: /api/approval');
  console.log('   - Inicialización: /api/initialize-slots');
  console.log('🔧 Utilidades:');
  console.log('   - Estado del sistema: GET /api/health');
  console.log('   - Inicializar sistema: POST /api/initialize-slots');
  console.log('   - Estado de inicialización: GET /api/initialize-slots/status');
  console.log('💡 El sistema se inicializa automáticamente en la primera consulta de cupos');
});

