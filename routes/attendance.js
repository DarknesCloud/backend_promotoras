const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const Slot = require('../models/Slot');
const User = require('../models/User');

// @route   GET api/attendance/slots
// @desc    Obtener slots con información de asistencias
// @access  Public
router.get('/slots', async (req, res) => {
  try {
    const { fecha, estado } = req.query;
    
    // Filtros para slots
    let filtroSlot = {};
    
    if (fecha) {
      const fechaInicio = new Date(fecha);
      const fechaFin = new Date(fecha);
      fechaFin.setDate(fechaFin.getDate() + 1);
      
      filtroSlot.fecha = {
        $gte: fechaInicio,
        $lt: fechaFin
      };
    }
    
    if (estado) {
      filtroSlot.estado = estado;
    }
    
    // Obtener slots
    const slots = await Slot.find(filtroSlot)
      .populate('usuariosRegistrados', 'nombre apellido email telefono estado')
      .sort({ fecha: 1, horaInicio: 1 });
    
    // Para cada slot, obtener las asistencias de forma segura
    const slotsConAsistencias = [];
    
    for (const slot of slots) {
      try {
        const asistencias = await Attendance.find({ slot: slot._id })
          .populate('user', 'nombre apellido email telefono estado');
        
        let estadisticas;
        try {
          estadisticas = await Attendance.obtenerEstadisticasSlot(slot._id);
        } catch (statsError) {
          console.error(`Error obteniendo estadísticas para slot ${slot._id}:`, statsError);
          estadisticas = {
            _id: slot._id,
            totalRegistrados: 0,
            asistieron: 0,
            noAsistieron: 0,
            pendientes: 0
          };
        }
        
        slotsConAsistencias.push({
          ...slot.toObject(),
          asistencias,
          estadisticas
        });
      } catch (slotError) {
        console.error(`Error procesando slot ${slot._id}:`, slotError);
        // Incluir el slot sin asistencias en caso de error
        slotsConAsistencias.push({
          ...slot.toObject(),
          asistencias: [],
          estadisticas: {
            _id: slot._id,
            totalRegistrados: 0,
            asistieron: 0,
            noAsistieron: 0,
            pendientes: 0
          }
        });
      }
    }
    
    res.json({
      success: true,
      data: slotsConAsistencias,
      count: slotsConAsistencias.length
    });
  } catch (error) {
    console.error('Error obteniendo slots con asistencias:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// @route   POST api/attendance/mark
// @desc    Marcar asistencia de un usuario
// @access  Public
router.post('/mark', async (req, res) => {
  try {
    const { userId, slotId, asistio, notas } = req.body;
    
    if (!userId || !slotId || asistio === undefined) {
      return res.status(400).json({
        success: false,
        message: 'userId, slotId y asistio son requeridos'
      });
    }
    
    // Verificar que el usuario y slot existen
    const user = await User.findById(userId);
    const slot = await Slot.findById(slotId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    if (!slot) {
      return res.status(404).json({
        success: false,
        message: 'Slot no encontrado'
      });
    }
    
    const attendance = await Attendance.marcarAsistencia(userId, slotId, asistio, notas);
    
    res.json({
      success: true,
      message: 'Asistencia marcada exitosamente',
      data: attendance
    });
  } catch (error) {
    console.error('Error marcando asistencia:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// @route   GET api/attendance/slot/:slotId
// @desc    Obtener asistencias de un slot específico
// @access  Public
router.get('/slot/:slotId', async (req, res) => {
  try {
    const { slotId } = req.params;
    
    const asistencias = await Attendance.obtenerAsistenciasPorSlot(slotId);
    const estadisticas = await Attendance.obtenerEstadisticasSlot(slotId);
    
    res.json({
      success: true,
      data: {
        asistencias,
        estadisticas
      }
    });
  } catch (error) {
    console.error('Error obteniendo asistencias del slot:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// @route   POST api/attendance/create-for-slot
// @desc    Crear registros de asistencia para todos los usuarios de un slot
// @access  Public
router.post('/create-for-slot', async (req, res) => {
  try {
    const { slotId } = req.body;
    
    if (!slotId) {
      return res.status(400).json({
        success: false,
        message: 'slotId es requerido'
      });
    }
    
    const asistenciasCreadas = await Attendance.crearAsistenciasParaSlot(slotId);
    
    res.json({
      success: true,
      message: `Se crearon ${asistenciasCreadas.length} registros de asistencia`,
      data: asistenciasCreadas
    });
  } catch (error) {
    console.error('Error creando asistencias para slot:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// @route   GET api/attendance/user/:userId
// @desc    Obtener historial de asistencias de un usuario
// @access  Public
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const asistencias = await Attendance.find({ user: userId })
      .populate('slot', 'fecha horaInicio horaFin enlaceMeet estado')
      .sort({ 'slot.fecha': -1 });
    
    res.json({
      success: true,
      data: asistencias
    });
  } catch (error) {
    console.error('Error obteniendo asistencias del usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// @route   GET api/attendance/stats
// @desc    Obtener estadísticas generales de asistencias
// @access  Public
router.get('/stats', async (req, res) => {
  try {
    const resumen = await Attendance.obtenerResumenAsistencias();
    
    res.json({
      success: true,
      data: resumen
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas de asistencias:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// @route   GET api/attendance/filter
// @desc    Obtener asistencias con filtros avanzados
// @access  Public
router.get('/filter', async (req, res) => {
  try {
    const { slotId, asistio, fechaDesde, fechaHasta } = req.query;
    
    const filtros = {};
    
    if (slotId) filtros.slotId = slotId;
    if (asistio !== undefined) filtros.asistio = asistio === 'true';
    if (fechaDesde) filtros.fechaDesde = fechaDesde;
    if (fechaHasta) filtros.fechaHasta = fechaHasta;
    
    const asistencias = await Attendance.obtenerAsistenciasConFiltros(filtros);
    
    res.json({
      success: true,
      data: asistencias,
      count: asistencias.length
    });
  } catch (error) {
    console.error('Error obteniendo asistencias con filtros:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// @route   PUT api/attendance/:id
// @desc    Actualizar registro de asistencia
// @access  Public
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { asistio, notas } = req.body;
    
    const updateData = {};
    if (asistio !== undefined) {
      updateData.asistio = asistio;
      updateData.fechaAsistencia = asistio ? new Date() : null;
    }
    if (notas !== undefined) updateData.notas = notas;
    
    const attendance = await Attendance.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('user', 'nombre apellido email')
     .populate('slot', 'fecha horaInicio horaFin');
    
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Registro de asistencia no encontrado'
      });
    }
    
    res.json({
      success: true,
      message: 'Asistencia actualizada exitosamente',
      data: attendance
    });
  } catch (error) {
    console.error('Error actualizando asistencia:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// @route   DELETE api/attendance/:id
// @desc    Eliminar registro de asistencia
// @access  Public
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const attendance = await Attendance.findByIdAndDelete(id);
    
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Registro de asistencia no encontrado'
      });
    }
    
    res.json({
      success: true,
      message: 'Registro de asistencia eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando asistencia:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

module.exports = router;

