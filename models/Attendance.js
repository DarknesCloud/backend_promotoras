const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  slot: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Slot',
    required: true
  },
  asistio: {
    type: Boolean,
    default: null // null = no marcado, true = asistió, false = no asistió
  },
  fechaAsistencia: {
    type: Date,
    default: null
  },
  notas: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Índices para optimizar consultas
attendanceSchema.index({ user: 1, slot: 1 }, { unique: true });
attendanceSchema.index({ slot: 1 });
attendanceSchema.index({ asistio: 1 });

// Método estático para marcar asistencia
attendanceSchema.statics.marcarAsistencia = async function(userId, slotId, asistio, notas = '') {
  try {
    const attendance = await this.findOneAndUpdate(
      { user: userId, slot: slotId },
      {
        asistio,
        fechaAsistencia: asistio ? new Date() : null,
        notas
      },
      { upsert: true, new: true }
    );
    
    return attendance;
  } catch (error) {
    console.error('Error marcando asistencia:', error);
    throw error;
  }
};

// Método estático para obtener asistencias por slot
attendanceSchema.statics.obtenerAsistenciasPorSlot = async function(slotId) {
  try {
    const asistencias = await this.find({ slot: slotId })
      .populate('user', 'nombre apellido email telefono estado')
      .populate('slot', 'fecha horaInicio horaFin')
      .sort({ 'user.nombre': 1 });
    
    return asistencias;
  } catch (error) {
    console.error('Error obteniendo asistencias por slot:', error);
    throw error;
  }
};

// Método estático para obtener estadísticas de asistencia por slot
attendanceSchema.statics.obtenerEstadisticasSlot = async function(slotId) {
  try {
    const estadisticas = await this.aggregate([
      { $match: { slot: new mongoose.Types.ObjectId(slotId) } },
      {
        $group: {
          _id: '$slot',
          totalRegistrados: { $sum: 1 },
          asistieron: { $sum: { $cond: [{ $eq: ['$asistio', true] }, 1, 0] } },
          noAsistieron: { $sum: { $cond: [{ $eq: ['$asistio', false] }, 1, 0] } },
          pendientes: { $sum: { $cond: [{ $eq: ['$asistio', null] }, 1, 0] } }
        }
      }
    ]);
    
    return estadisticas.length > 0 ? estadisticas[0] : {
      _id: slotId,
      totalRegistrados: 0,
      asistieron: 0,
      noAsistieron: 0,
      pendientes: 0
    };
  } catch (error) {
    console.error('Error obteniendo estadísticas de slot:', error);
    throw error;
  }
};

// Método estático para obtener todas las asistencias con filtros
attendanceSchema.statics.obtenerAsistenciasConFiltros = async function(filtros = {}) {
  try {
    const query = {};
    
    if (filtros.slotId) {
      query.slot = filtros.slotId;
    }
    
    if (filtros.asistio !== undefined) {
      query.asistio = filtros.asistio;
    }
    
    if (filtros.fechaDesde || filtros.fechaHasta) {
      const Slot = require('./Slot');
      const slotQuery = {};
      
      if (filtros.fechaDesde) {
        slotQuery.fecha = { $gte: new Date(filtros.fechaDesde) };
      }
      
      if (filtros.fechaHasta) {
        slotQuery.fecha = { ...slotQuery.fecha, $lte: new Date(filtros.fechaHasta) };
      }
      
      const slots = await Slot.find(slotQuery).select('_id');
      query.slot = { $in: slots.map(slot => slot._id) };
    }
    
    const asistencias = await this.find(query)
      .populate('user', 'nombre apellido email telefono estado')
      .populate('slot', 'fecha horaInicio horaFin enlaceMeet estado')
      .sort({ 'slot.fecha': -1, 'slot.horaInicio': 1 });
    
    return asistencias;
  } catch (error) {
    console.error('Error obteniendo asistencias con filtros:', error);
    throw error;
  }
};

// Método estático para crear asistencias automáticamente cuando se llena un slot
attendanceSchema.statics.crearAsistenciasParaSlot = async function(slotId) {
  try {
    const Slot = require('./Slot');
    const slot = await Slot.findById(slotId).populate('usuariosRegistrados');
    
    if (!slot || !slot.usuariosRegistrados) {
      throw new Error('Slot no encontrado o sin usuarios registrados');
    }
    
    const asistenciasCreadas = [];
    
    for (const usuario of slot.usuariosRegistrados) {
      try {
        const existeAsistencia = await this.findOne({
          user: usuario._id,
          slot: slotId
        });
        
        if (!existeAsistencia) {
          const nuevaAsistencia = new this({
            user: usuario._id,
            slot: slotId,
            asistio: null // Pendiente de marcar
          });
          
          await nuevaAsistencia.save();
          asistenciasCreadas.push(nuevaAsistencia);
        }
      } catch (userError) {
        console.error(`Error creando asistencia para usuario ${usuario._id}:`, userError);
      }
    }
    
    return asistenciasCreadas;
  } catch (error) {
    console.error('Error creando asistencias para slot:', error);
    throw error;
  }
};

// Método estático para obtener resumen de asistencias
attendanceSchema.statics.obtenerResumenAsistencias = async function() {
  try {
    const resumen = await this.aggregate([
      {
        $group: {
          _id: null,
          totalAsistencias: { $sum: 1 },
          asistieron: { $sum: { $cond: [{ $eq: ['$asistio', true] }, 1, 0] } },
          noAsistieron: { $sum: { $cond: [{ $eq: ['$asistio', false] }, 1, 0] } },
          pendientes: { $sum: { $cond: [{ $eq: ['$asistio', null] }, 1, 0] } }
        }
      }
    ]);
    
    return resumen.length > 0 ? resumen[0] : {
      totalAsistencias: 0,
      asistieron: 0,
      noAsistieron: 0,
      pendientes: 0
    };
  } catch (error) {
    console.error('Error obteniendo resumen de asistencias:', error);
    throw error;
  }
};

module.exports = mongoose.model('Attendance', attendanceSchema);

