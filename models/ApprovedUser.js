const mongoose = require('mongoose');

const approvedUserSchema = new mongoose.Schema({
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
    trim: true
  },
  telefono: {
    type: String,
    required: true,
    trim: true
  },
  edad: {
    type: Number,
    required: true
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
    required: true
  },
  horaCita: {
    type: String,
    required: true
  },
  enlaceMeet: {
    type: String,
    required: true
  },
  idioma: {
    type: String,
    required: false,
    trim: true,
    default: 'Español'
  },
  fechaAprobacion: {
    type: Date,
    default: Date.now
  },
  originalUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ApprovedUser', approvedUserSchema);

