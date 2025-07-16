const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  apellido: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Por favor ingrese un email válido']
  },
  telefono: {
    type: String,
    required: false,
    trim: true
  },
  edad: {
    type: Number,
    required: false,
    min: [18, 'La edad mínima es 18 años'],
    max: [100, 'La edad máxima es 100 años']
  },
  zipCode: {
    type: String,
    required: false,
    trim: true
  },
  // Referencia al slot asignado (nuevo campo)
  slot: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Slot',
    required: false
  },
  // Campos legacy mantenidos para compatibilidad
  fechaCita: {
    type: Date,
    required: false
  },
  horaCita: {
    type: String,
    required: false
  },
  enlaceMeet: {
    type: String,
    required: false
  },
  eventId: {
    type: String,
    required: false
  },
  htmlLink: {
    type: String,
    required: false
  },
  // Campo de idioma actualizado para soportar múltiples idiomas
  idiomas: {
    type: [String],
    required: false,
    default: ['Español'],
    validate: {
      validator: function(idiomas) {
        // Validar que al menos haya un idioma seleccionado
        return idiomas && idiomas.length > 0;
      },
      message: 'Debe seleccionar al menos un idioma'
    }
  },
  // Campo legacy mantenido para compatibilidad
  idioma: {
    type: String,
    required: false,
    trim: true,
    default: 'Español'
  },
  esImportado: {
    type: Boolean,
    default: false
  },
  estado: {
    type: String,
    enum: ["pendiente", "agendado", "reunion_realizada", "aprobado", "desaprobado"],
    default: "pendiente"
  },
  asistencia: {
    type: Boolean,
    default: null
  },
  // Nuevos campos para el flujo de aprobación
  fechaAprobacion: {
    type: Date,
    required: false
  },
  aprobadoPor: {
    type: String,
    required: false
  },
  motivoDesaprobacion: {
    type: String,
    required: false,
    trim: true
  },
  // Campo para marcar si se envió correo de aprobación
  correoAprobacionEnviado: {
    type: Boolean,
    default: false
  },
  fechaCreacion: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Middleware pre-save para sincronizar idioma e idiomas
userSchema.pre('save', function(next) {
  // Si se proporciona idiomas pero no idioma, usar el primero de la lista
  if (this.idiomas && this.idiomas.length > 0 && !this.idioma) {
    this.idioma = this.idiomas[0];
  }
  
  // Si se proporciona idioma pero no idiomas, crear array con ese idioma
  if (this.idioma && (!this.idiomas || this.idiomas.length === 0)) {
    this.idiomas = [this.idioma];
  }
  
  next();
});

// Método para aprobar usuario
userSchema.methods.aprobar = function(aprobadoPor) {
  this.estado = 'aprobado';
  this.fechaAprobacion = new Date();
  this.aprobadoPor = aprobadoPor;
  this.motivoDesaprobacion = undefined;
  return this.save();
};

// Método para desaprobar usuario
userSchema.methods.desaprobar = function(motivo, desaprobadoPor) {
  this.estado = 'desaprobado';
  this.motivoDesaprobacion = motivo;
  this.aprobadoPor = desaprobadoPor;
  this.fechaAprobacion = new Date();
  return this.save();
};

// Método virtual para obtener el nombre completo
userSchema.virtual('nombreCompleto').get(function() {
  return `${this.nombre} ${this.apellido}`;
});

// Método virtual para obtener idiomas como string
userSchema.virtual('idiomasTexto').get(function() {
  return this.idiomas ? this.idiomas.join(', ') : this.idioma || 'Español';
});

// Configurar opciones de transformación JSON
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', userSchema);

