const express = require('express');
const router = express.Router();
const ScheduleConfig = require('../models/ScheduleConfig');
const Slot = require('../models/Slot');

// @route   POST api/initialize-slots
// @desc    Inicializar el sistema con configuración por defecto y crear cupos
// @access  Public
router.post('/', async (req, res) => {
  try {
    console.log('Iniciando proceso de inicialización del sistema...');
    
    // Verificar si ya existe una configuración activa
    let config = await ScheduleConfig.getActiveConfig();
    
    if (!config) {
      console.log('No se encontró configuración activa, creando configuración por defecto...');
      config = await ScheduleConfig.createDefaultConfig();
      console.log('Configuración por defecto creada:', config.name);
    } else {
      console.log('Configuración activa encontrada:', config.name);
    }
    
    // Generar cupos basado en la configuración
    console.log('Generando cupos basado en la configuración...');
    const slotsCreated = await config.generateSlots();
    
    // Obtener estadísticas de cupos
    const totalSlots = await Slot.countDocuments();
    const availableSlots = await Slot.countDocuments({ estado: 'disponible' });
    const fullSlots = await Slot.countDocuments({ estado: 'lleno' });
    
    console.log(`Proceso completado. Cupos creados: ${slotsCreated.length}`);
    
    res.json({
      success: true,
      message: 'Sistema inicializado exitosamente',
      data: {
        config: {
          id: config._id,
          name: config.name,
          startDate: config.startDate,
          endDate: config.endDate,
          allowedWeekDays: config.allowedWeekDays,
          timeSlots: config.timeSlots,
          isActive: config.isActive
        },
        slots: {
          created: slotsCreated.length,
          total: totalSlots,
          available: availableSlots,
          full: fullSlots
        }
      }
    });
  } catch (error) {
    console.error('Error inicializando sistema:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// @route   GET api/initialize-slots/status
// @desc    Obtener estado del sistema
// @access  Public
router.get('/status', async (req, res) => {
  try {
    const config = await ScheduleConfig.getActiveConfig();
    
    if (!config) {
      return res.json({
        success: true,
        initialized: false,
        message: 'Sistema no inicializado. Use POST /api/initialize-slots para inicializar.'
      });
    }
    
    // Obtener estadísticas de cupos
    const totalSlots = await Slot.countDocuments();
    const availableSlots = await Slot.countDocuments({ estado: 'disponible' });
    const fullSlots = await Slot.countDocuments({ estado: 'lleno' });
    const realizedSlots = await Slot.countDocuments({ estado: 'realizada' });
    const cancelledSlots = await Slot.countDocuments({ estado: 'cancelada' });
    
    // Obtener cupos de la próxima semana
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const upcomingSlots = await Slot.countDocuments({
      fecha: { $gte: new Date(), $lte: nextWeek },
      estado: { $in: ['disponible', 'lleno'] }
    });
    
    res.json({
      success: true,
      initialized: true,
      data: {
        config: {
          id: config._id,
          name: config.name,
          isActive: config.isActive,
          autoCreateSlots: config.autoCreateSlots,
          timeSlots: config.timeSlots.length,
          allowedDays: config.allowedWeekDays.length
        },
        slots: {
          total: totalSlots,
          available: availableSlots,
          full: fullSlots,
          realized: realizedSlots,
          cancelled: cancelledSlots,
          upcoming: upcomingSlots
        },
        lastUpdate: config.updatedAt
      }
    });
  } catch (error) {
    console.error('Error obteniendo estado del sistema:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// @route   POST api/initialize-slots/reset
// @desc    Resetear el sistema (eliminar todos los cupos y configuraciones)
// @access  Public
router.post('/reset', async (req, res) => {
  try {
    const { confirm } = req.body;
    
    if (confirm !== 'RESET_SYSTEM') {
      return res.status(400).json({
        success: false,
        message: 'Para resetear el sistema, debe enviar { "confirm": "RESET_SYSTEM" }'
      });
    }
    
    console.log('Iniciando reset del sistema...');
    
    // Eliminar todos los cupos
    const deletedSlots = await Slot.deleteMany({});
    console.log(`Eliminados ${deletedSlots.deletedCount} cupos`);
    
    // Eliminar todas las configuraciones
    const deletedConfigs = await ScheduleConfig.deleteMany({});
    console.log(`Eliminadas ${deletedConfigs.deletedCount} configuraciones`);
    
    console.log('Reset completado');
    
    res.json({
      success: true,
      message: 'Sistema reseteado exitosamente',
      data: {
        slotsDeleted: deletedSlots.deletedCount,
        configsDeleted: deletedConfigs.deletedCount
      }
    });
  } catch (error) {
    console.error('Error reseteando sistema:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// @route   POST api/initialize-slots/maintenance
// @desc    Ejecutar tareas de mantenimiento
// @access  Public
router.post('/maintenance', async (req, res) => {
  try {
    console.log('Ejecutando tareas de mantenimiento...');
    
    const results = {
      oldSlotsRemoved: 0,
      orphanSlotsFixed: 0,
      configUpdated: false
    };
    
    // Eliminar cupos antiguos (más de 30 días en el pasado)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const oldSlots = await Slot.deleteMany({
      fecha: { $lt: thirtyDaysAgo },
      estado: { $in: ['realizada', 'cancelada'] }
    });
    results.oldSlotsRemoved = oldSlots.deletedCount;
    
    // Actualizar cupos huérfanos (sin configuración)
    const orphanSlots = await Slot.find({ configId: null });
    const activeConfig = await ScheduleConfig.getActiveConfig();
    
    if (activeConfig && orphanSlots.length > 0) {
      await Slot.updateMany(
        { configId: null },
        { configId: activeConfig._id }
      );
      results.orphanSlotsFixed = orphanSlots.length;
    }
    
    // Verificar y actualizar configuración si es necesario
    if (activeConfig) {
      const now = new Date();
      if (activeConfig.endDate < now) {
        // Extender la configuración por 3 meses más
        activeConfig.endDate = new Date();
        activeConfig.endDate.setMonth(activeConfig.endDate.getMonth() + 3);
        await activeConfig.save();
        results.configUpdated = true;
      }
    }
    
    console.log('Mantenimiento completado:', results);
    
    res.json({
      success: true,
      message: 'Tareas de mantenimiento ejecutadas exitosamente',
      data: results
    });
  } catch (error) {
    console.error('Error ejecutando mantenimiento:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

module.exports = router;

