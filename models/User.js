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
    required: true,
    trim: true
  },
  edad: {
    type: Number,
    required: true,
    min: [18, 'La edad mínima es 18 años'],
    max: [100, 'La edad máxima es 100 años']
  },
  ciudad: {
    type: String,
    required: true,
    trim: true
  },
  experiencia: {
    type: String,
    required: true,
    trim: true
  },
  motivacion: {
    type: String,
    required: true,
    trim: true
  },
  disponibilidad: {
    type: String,
    required: true,
    trim: true
  },
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
  fechaCreacion: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);

