const express = require('express');
const router = express.Router();
const Slot = require('../models/Slot');
const User = require('../models/User');
const { startOfDay, endOfDay, format, parseISO } = require('date-fns');

// GET /api/appointments - Obtener todas las citas agrupadas por día
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let query = {};
    if (startDate && endDate) {
      query.fecha = {
        $gte: parseISO(startDate),
        $lte: parseISO(endDate),
      };
    }

    const slots = await Slot.find(query)
      .populate(
        'usuariosRegistrados.usuario',
        'nombre apellido email telefono estado'
      )
      .sort({ fecha: 1, horaInicio: 1 });

    const appointmentsByDay = {};

    slots.forEach((slot) => {
      const dateKey = format(slot.fecha, 'yyyy-MM-dd');

      if (!appointmentsByDay[dateKey]) {
        appointmentsByDay[dateKey] = {
          date: dateKey,
          totalAppointments: 0,
          slots: [],
        };
      }

      appointmentsByDay[dateKey].totalAppointments += Array.isArray(
        slot.usuariosRegistrados
      )
        ? slot.usuariosRegistrados.length
        : 0;
      appointmentsByDay[dateKey].slots.push({
        _id: slot._id,
        horaInicio: slot.horaInicio,
        horaFin: slot.horaFin,
        capacidadMaxima: slot.capacidadMaxima,
        estado: slot.estado,
        enlaceMeet: slot.enlaceMeet,
        usuarios: Array.isArray(slot.usuariosRegistrados)
          ? slot.usuariosRegistrados.map((ur) => {
              if (ur.usuario && typeof ur.usuario.toObject === 'function') {
                return {
                  ...ur.usuario.toObject(),
                  estadoAprobacion: ur.estadoAprobacion,
                  fechaRegistro: ur.fechaRegistro,
                  fechaAprobacion: ur.fechaAprobacion,
                };
              } else {
                return {
                  usuario: null,
                  estadoAprobacion: ur.estadoAprobacion,
                  fechaRegistro: ur.fechaRegistro,
                  fechaAprobacion: ur.fechaAprobacion,
                };
              }
            })
          : [],
      });
    });

    res.json({
      success: true,
      data: appointmentsByDay,
      message: `Citas agrupadas por día obtenidas exitosamente`,
    });
  } catch (error) {
    console.error('❌ Error obteniendo citas:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo citas',
      error: error.message,
    });
  }
});

// GET /api/appointments/day/:date - Obtener citas de un día específico
router.get('/day/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const targetDate = parseISO(date);

    const slots = await Slot.find({
      fecha: {
        $gte: startOfDay(targetDate),
        $lte: endOfDay(targetDate),
      },
    })
      .populate(
        'usuariosRegistrados.usuario',
        'nombre apellido email telefono estado'
      )
      .sort({ horaInicio: 1 });

    const appointments = Array.isArray(slots)
      ? slots.map((slot) => ({
          _id: slot._id,
          fecha: slot.fecha,
          horaInicio: slot.horaInicio,
          horaFin: slot.horaFin,
          capacidadMaxima: slot.capacidadMaxima,
          estado: slot.estado,
          enlaceMeet: slot.enlaceMeet,
          usuarios: Array.isArray(slot.usuariosRegistrados)
            ? slot.usuariosRegistrados.map((ur) => {
                if (ur.usuario && typeof ur.usuario.toObject === 'function') {
                  return {
                    ...ur.usuario.toObject(),
                    estadoAprobacion: ur.estadoAprobacion,
                    fechaRegistro: ur.fechaRegistro,
                    fechaAprobacion: ur.fechaAprobacion,
                  };
                } else {
                  return {
                    usuario: null,
                    estadoAprobacion: ur.estadoAprobacion,
                    fechaRegistro: ur.fechaRegistro,
                    fechaAprobacion: ur.fechaAprobacion,
                  };
                }
              })
            : [],
        }))
      : [];

    res.json({
      success: true,
      data: {
        date: date,
        totalAppointments: appointments.reduce(
          (sum, slot) =>
            sum + (Array.isArray(slot.usuarios) ? slot.usuarios.length : 0),
          0
        ),
        appointments: appointments,
      },
      message: `Citas del día ${date} obtenidas exitosamente`,
    });
  } catch (error) {
    console.error('❌ Error obteniendo citas del día:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo citas del día',
      error: error.message,
    });
  }
});

// PUT /api/appointments/slot/:slotId - Actualizar información de un slot
router.put('/slot/:slotId', async (req, res) => {
  try {
    const { slotId } = req.params;
    const { estado, descripcion } = req.body;

    const slot = await Slot.findById(slotId);
    if (!slot) {
      return res.status(404).json({
        success: false,
        message: 'Slot no encontrado',
      });
    }

    if (estado) slot.estado = estado;
    if (descripcion !== undefined) slot.descripcion = descripcion;

    await slot.save();

    res.json({
      success: true,
      data: slot,
      message: 'Slot actualizado exitosamente',
    });
  } catch (error) {
    console.error('❌ Error actualizando slot:', error);
    res.status(500).json({
      success: false,
      message: 'Error actualizando slot',
      error: error.message,
    });
  }
});

// DELETE /api/appointments/slot/:slotId/user/:userId - Remover usuario de un slot
router.delete('/slot/:slotId/user/:userId', async (req, res) => {
  try {
    const { slotId, userId } = req.params;

    const slot = await Slot.findById(slotId);
    if (!slot) {
      return res.status(404).json({
        success: false,
        message: 'Slot no encontrado',
      });
    }

    await slot.removerUsuario(userId);

    await User.findByIdAndUpdate(userId, {
      estado: 'pendiente',
      slot: null,
    });

    res.json({
      success: true,
      message: 'Usuario removido del slot exitosamente',
    });
  } catch (error) {
    console.error('❌ Error removiendo usuario del slot:', error);
    res.status(500).json({
      success: false,
      message: 'Error removiendo usuario del slot',
      error: error.message,
    });
  }
});

// POST /api/appointments/slot/:slotId/user/:userId - Agregar usuario a un slot
router.post('/slot/:slotId/user/:userId', async (req, res) => {
  try {
    const { slotId, userId } = req.params;

    const slot = await Slot.findById(slotId);
    if (!slot) {
      return res.status(404).json({
        success: false,
        message: 'Slot no encontrado',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    await slot.registrarUsuario(userId);

    await User.findByIdAndUpdate(userId, {
      estado: 'agendado',
      slot: slotId,
    });

    res.json({
      success: true,
      message: 'Usuario agregado al slot exitosamente',
    });
  } catch (error) {
    console.error('❌ Error agregando usuario al slot:', error);
    res.status(500).json({
      success: false,
      message: 'Error agregando usuario al slot',
      error: error.message,
    });
  }
});

// GET /api/appointments/stats - Obtener estadísticas de citas
router.get('/stats', async (req, res) => {
  try {
    const totalSlots = await Slot.countDocuments();
    const slotsWithUsers = await Slot.countDocuments({
      'usuariosRegistrados.0': { $exists: true },
    });
    const fullSlots = await Slot.countDocuments({ estado: 'lleno' });

    const totalUsers = await User.countDocuments();
    const scheduledUsers = await User.countDocuments({ estado: 'agendado' });
    const approvedUsers = await User.countDocuments({ estado: 'aprobado' });

    res.json({
      success: true,
      data: {
        slots: {
          total: totalSlots,
          withUsers: slotsWithUsers,
          full: fullSlots,
          available: totalSlots - fullSlots,
        },
        users: {
          total: totalUsers,
          scheduled: scheduledUsers,
          approved: approvedUsers,
          pending: totalUsers - scheduledUsers - approvedUsers,
        },
      },
      message: 'Estadísticas obtenidas exitosamente',
    });
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo estadísticas',
      error: error.message,
    });
  }
});

// POST /api/appointments/slot/:slotId/generate-meet - Generar enlace de Meet para un slot
router.post('/slot/:slotId/generate-meet', async (req, res) => {
  try {
    const { slotId } = req.params;

    const slot = await Slot.findById(slotId);
    if (!slot) {
      return res.status(404).json({
        success: false,
        message: 'Slot no encontrado',
      });
    }

    const meetLink = await slot.generarEnlaceMeet();

    res.json({
      success: true,
      data: {
        slotId: slot._id,
        enlaceMeet: meetLink,
      },
      message: 'Enlace de Meet generado exitosamente',
    });
  } catch (error) {
    console.error('❌ Error generando enlace de Meet:', error);
    res.status(500).json({
      success: false,
      message: 'Error generando enlace de Meet',
      error: error.message,
    });
  }
});

// PUT /api/appointments/slot/:slotId/user/:userId/approve - Aprobar usuario en un slot
router.put('/slot/:slotId/user/:userId/approve', async (req, res) => {
  try {
    const { slotId, userId } = req.params;
    const { aprobadoPor } = req.body;

    const slot = await Slot.findById(slotId);
    if (!slot) {
      return res.status(404).json({
        success: false,
        message: 'Slot no encontrado',
      });
    }

    await slot.aprobarUsuario(userId, aprobadoPor || 'Admin');

    await User.findByIdAndUpdate(userId, {
      estado: 'aprobado',
      fechaAprobacion: new Date(),
      aprobadoPor: aprobadoPor || 'Admin',
    });

    res.json({
      success: true,
      message: 'Usuario aprobado exitosamente',
    });
  } catch (error) {
    console.error('❌ Error aprobando usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error aprobando usuario',
      error: error.message,
    });
  }
});

// PUT /api/appointments/slot/:slotId/user/:userId/disapprove - Desaprobar usuario en un slot
router.put('/slot/:slotId/user/:userId/disapprove', async (req, res) => {
  try {
    const { slotId, userId } = req.params;
    const { motivo, desaprobadoPor } = req.body;

    const slot = await Slot.findById(slotId);
    if (!slot) {
      return res.status(404).json({
        success: false,
        message: 'Slot no encontrado',
      });
    }

    await slot.desaprobarUsuario(userId, motivo, desaprobadoPor || 'Admin');

    await User.findByIdAndUpdate(userId, {
      estado: 'desaprobado',
      motivoDesaprobacion: motivo,
      fechaAprobacion: new Date(),
      aprobadoPor: desaprobadoPor || 'Admin',
    });

    res.json({
      success: true,
      message: 'Usuario desaprobado exitosamente',
    });
  } catch (error) {
    console.error('❌ Error desaprobando usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error desaprobando usuario',
      error: error.message,
    });
  }
});

module.exports = router;
