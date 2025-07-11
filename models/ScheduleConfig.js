const mongoose = require("mongoose");

const scheduleConfigSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    default: 'Configuración Principal'
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  allowedWeekDays: {
    type: [Number], // 1 for Monday, 2 for Tuesday, etc. (1-7)
    required: true,
    default: [1, 2, 3, 4, 5] // Lunes a viernes
  },
  timeSlots: [{
    startTime: {
      type: String,
      required: true,
      match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:MM)']
    },
    endTime: {
      type: String,
      required: true,
      match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:MM)']
    },
    duration: {
      type: Number,
      required: true,
      default: 30 // duración en minutos
    },
    capacity: {
      type: Number,
      required: true,
      min: [10, 'La capacidad mínima es 10 usuarios'],
      max: [15, 'La capacidad máxima es 15 usuarios'],
      default: 15
    }
  }],
  timeZone: {
    type: String,
    required: true,
    default: "America/Mexico_City",
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  autoCreateSlots: {
    type: Boolean,
    default: true,
  },
  weeksInAdvance: {
    type: Number,
    default: 4, // Crear cupos con 4 semanas de anticipación
    min: 1,
    max: 12
  }
}, {
  timestamps: true,
});

// Método para generar slots basado en la configuración
scheduleConfigSchema.methods.generateSlots = async function() {
  const Slot = mongoose.model('Slot');
  const slotsCreated = [];
  
  const startDate = new Date(this.startDate);
  const endDate = new Date(this.endDate);
  
  // Iterar por cada día en el rango
  for (let currentDate = new Date(startDate); currentDate <= endDate; currentDate.setDate(currentDate.getDate() + 1)) {
    const dayOfWeek = currentDate.getDay() === 0 ? 7 : currentDate.getDay(); // Convertir domingo (0) a 7
    
    // Verificar si el día está permitido
    if (this.allowedWeekDays.includes(dayOfWeek)) {
      // Crear slots para cada franja horaria
      for (const timeSlot of this.timeSlots) {
        // Verificar si ya existe el slot
        const existingSlot = await Slot.findOne({
          fecha: currentDate,
          horaInicio: timeSlot.startTime
        });
        
        if (!existingSlot) {
          const newSlot = new Slot({
            fecha: new Date(currentDate),
            horaInicio: timeSlot.startTime,
            horaFin: timeSlot.endTime,
            capacidadMaxima: timeSlot.capacity,
            configId: this._id
          });
          
          await newSlot.save();
          slotsCreated.push(newSlot);
        }
      }
    }
  }
  
  return slotsCreated;
};

// Método estático para obtener la configuración activa
scheduleConfigSchema.statics.getActiveConfig = async function() {
  return await this.findOne({ isActive: true });
};

// Método estático para crear configuración por defecto
scheduleConfigSchema.statics.createDefaultConfig = async function() {
  const existingConfig = await this.findOne({ isActive: true });
  if (existingConfig) {
    return existingConfig;
  }
  
  const today = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 3); // 3 meses hacia adelante
  
  const defaultConfig = new this({
    name: 'Configuración Principal',
    startDate: today,
    endDate: endDate,
    allowedWeekDays: [1, 2, 3, 4, 5], // Lunes a viernes
    timeSlots: [
      // Horarios matutinos (9-11 AM) - intervalos de 1 hora
      { startTime: '09:00', endTime: '10:00', duration: 60, capacity: 15 },
      { startTime: '10:00', endTime: '11:00', duration: 60, capacity: 15 },
      // Horarios vespertinos (4-7 PM) - intervalos de 1 hora
      { startTime: '16:00', endTime: '17:00', duration: 60, capacity: 15 },
      { startTime: '17:00', endTime: '18:00', duration: 60, capacity: 15 },
      { startTime: '18:00', endTime: '19:00', duration: 60, capacity: 15 }
    ],
    isActive: true,
    autoCreateSlots: true
  });
  
  await defaultConfig.save();
  return defaultConfig;
};

module.exports = mongoose.model("ScheduleConfig", scheduleConfigSchema);

