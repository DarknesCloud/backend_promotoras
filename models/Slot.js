const mongoose = require('mongoose');
const { google } = require('googleapis');

const slotSchema = new mongoose.Schema(
  {
    fecha: { type: Date, required: true },
    horaInicio: { type: String, required: true },
    horaFin: { type: String, required: true },
    capacidadMaxima: {
      type: Number,
      required: true,
      min: 10,
      max: 15,
      default: 15,
    },
    usuariosRegistrados: [
      {
        usuario: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        fechaRegistro: { type: Date, default: Date.now },
        estadoAprobacion: {
          type: String,
          enum: ['pendiente', 'aprobado', 'desaprobado'],
          default: 'pendiente',
        },
        fechaAprobacion: Date,
        aprobadoPor: String,
        motivoDesaprobacion: String,
      },
    ],
    enlaceMeet: { type: String, default: null },
    estado: {
      type: String,
      enum: ['disponible', 'lleno', 'realizada', 'cancelada'],
      default: 'disponible',
    },
    configId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ScheduleConfig',
      default: null,
    },
    meetingId: { type: String, default: null },
    descripcion: { type: String, default: '' },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtuals
slotSchema.virtual('usuariosCount').get(function () {
  return Array.isArray(this.usuariosRegistrados)
    ? this.usuariosRegistrados.length
    : 0;
});
slotSchema.virtual('estaLleno').get(function () {
  return this.usuariosCount >= this.capacidadMaxima;
});
slotSchema.virtual('cuposDisponibles').get(function () {
  return this.capacidadMaxima - this.usuariosCount;
});
slotSchema.virtual('usuariosAprobados').get(function () {
  return (
    this.usuariosRegistrados?.filter((ur) => ur.estadoAprobacion === 'aprobado')
      ?.length || 0
  );
});
slotSchema.virtual('usuariosPendientes').get(function () {
  return (
    this.usuariosRegistrados?.filter(
      (ur) => ur.estadoAprobacion === 'pendiente'
    )?.length || 0
  );
});

// Índices
slotSchema.index({ fecha: 1, horaInicio: 1 });
slotSchema.index({ estado: 1 });
slotSchema.index({ configId: 1 });

// Middleware
slotSchema.pre('save', function (next) {
  const count = this.usuariosCount;
  if (count >= this.capacidadMaxima && this.estado === 'disponible')
    this.estado = 'lleno';
  else if (count < this.capacidadMaxima && this.estado === 'lleno')
    this.estado = 'disponible';
  next();
});

// Métodos estáticos
slotSchema.statics.crearCuposSemanales = async function () {
  const ScheduleConfig = require('./ScheduleConfig');
  const activeConfig = await ScheduleConfig.getActiveConfig();
  if (!activeConfig) throw new Error('No hay configuración activa');
  return await activeConfig.generateSlots();
};

slotSchema.statics.obtenerCuposDisponibles = async function (
  fechaInicio,
  fechaFin
) {
  const query = { estado: { $in: ['disponible', 'lleno'] } };
  if (fechaInicio && fechaFin) {
    query.fecha = { $gte: new Date(fechaInicio), $lte: new Date(fechaFin) };
  } else if (fechaInicio) {
    query.fecha = { $gte: new Date(fechaInicio) };
  }
  return await this.find(query)
    .populate('usuariosRegistrados.usuario', 'nombre email telefono')
    .populate('configId', 'name')
    .sort({ fecha: 1, horaInicio: 1 });
};

// Método: Generar enlace Meet
slotSchema.methods.generarEnlaceMeet = async function () {
  if (this.enlaceMeet) return this.enlaceMeet;
  
  const { OAuth2Client } = require("google-auth-library");
  const GoogleCredentials = require('./GoogleCredentials');
  
  // Obtener credenciales almacenadas en la base de datos
  const storedCredentials = await GoogleCredentials.getSystemCredentials();
  
  if (!storedCredentials) {
    throw new Error('No hay credenciales de Google configuradas. Por favor, configura la autenticación de Google desde el panel de administración.');
  }
  
  if (storedCredentials.isExpired()) {
    console.warn('⚠️ Las credenciales de Google han expirado. Se intentará refrescar automáticamente.');
  }

  const oAuth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  // Configurar las credenciales almacenadas
  oAuth2Client.setCredentials({
    access_token: storedCredentials.access_token,
    refresh_token: storedCredentials.refresh_token,
    token_type: storedCredentials.token_type,
    expiry_date: storedCredentials.expiry_date
  });

  try {
    // Intentar refrescar el token si es necesario
    if (storedCredentials.isExpired()) {
      const { credentials } = await oAuth2Client.refreshAccessToken();
      
      // Actualizar las credenciales en la base de datos
      await GoogleCredentials.updateSystemCredentials({
        access_token: credentials.access_token,
        refresh_token: credentials.refresh_token || storedCredentials.refresh_token,
        token_type: credentials.token_type || storedCredentials.token_type,
        scope: storedCredentials.scope,
        expiry_date: credentials.expiry_date
      });
      
      console.log('✅ Token de acceso refrescado automáticamente');
    }
    
    // Marcar las credenciales como usadas
    await storedCredentials.markAsUsed();
    
  } catch (refreshError) {
    console.error('❌ Error al refrescar token:', refreshError);
    throw new Error('Error al refrescar el token de acceso. Las credenciales pueden haber sido revocadas. Por favor, vuelve a autenticarte desde el panel de administración.');
  }

  const auth = oAuth2Client;
  const calendar = google.calendar({ version: 'v3', auth });

  const startDateTime = new Date(this.fecha);
  const [hours, minutes] = this.horaInicio.split(':');
  startDateTime.setHours(+hours, +minutes, 0, 0);

  const endDateTime = new Date(this.fecha);
  const [endHours, endMinutes] = this.horaFin.split(':');
  endDateTime.setHours(+endHours, +endMinutes, 0, 0);

  const User = require('./User');
  const usuarios = await User.find({
    _id: { $in: this.usuariosRegistrados.map((u) => u.usuario) },
  });

  const event = {
    summary: `Reunión Promotoras - ${this.horaInicio}`,
    description: `Reunión del programa de promotoras. Capacidad: ${this.capacidadMaxima} personas.`,
    start: {
      dateTime: startDateTime.toISOString(),
      timeZone: 'America/Mexico_City',
    },
    end: {
      dateTime: endDateTime.toISOString(),
      timeZone: 'America/Mexico_City',
    },
    conferenceData: {
      createRequest: {
        requestId: `meet-${this._id}-${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
    attendees: usuarios.map((user) => ({ email: user.email })),
  };

  const response = await calendar.events.insert({
    calendarId: 'primary',
    resource: event,
    conferenceDataVersion: 1,
    sendUpdates: 'all',
  });

  const meetLink = response.data.conferenceData?.entryPoints?.find(
    (entry) => entry.entryPointType === 'video'
  );
  if (meetLink) {
    this.enlaceMeet = meetLink.uri;
    this.meetingId = response.data.id;
    await this.save();
    return this.enlaceMeet;
  }

  throw new Error('No se pudo generar el enlace de Meet');
};

// Método: Registrar Usuario (CORREGIDO)
slotSchema.methods.registrarUsuario = async function (userId) {
  try {
    if (!userId) throw new Error('userId no está definido');

    if (!this.usuariosRegistrados) this.usuariosRegistrados = [];

    const existe = this.usuariosRegistrados.find(
      (ur) => ur?.usuario?.toString?.() === userId.toString()
    );
    if (existe) throw new Error('El usuario ya está registrado en este cupo');

    if (this.usuariosRegistrados.length >= this.capacidadMaxima)
      throw new Error('El cupo está lleno');

    this.usuariosRegistrados.push({
      usuario: userId,
      fechaRegistro: new Date(),
      estadoAprobacion: 'pendiente',
    });

    if (this.usuariosRegistrados.length >= this.capacidadMaxima) {
      this.estado = 'lleno';
      try {
        await this.generarEnlaceMeet();
      } catch (e) {
        console.error('Error generando Meet:', e);
      }
    }

    await this.save();
    return this;
  } catch (error) {
    console.error('Error registrando usuario:', error);
    throw error;
  }
};

// Método: Remover Usuario
slotSchema.methods.removerUsuario = async function (userId) {
  try {
    const original = this.usuariosRegistrados.length;
    this.usuariosRegistrados = this.usuariosRegistrados.filter(
      (ur) => ur?.usuario?.toString?.() !== userId.toString()
    );
    if (this.usuariosRegistrados.length < original) await this.save();
    return this;
  } catch (error) {
    console.error('Error removiendo usuario del slot:', error);
    throw error;
  }
};

// Método: Aprobar Usuario
slotSchema.methods.aprobarUsuario = async function (userId, aprobadoPor) {
  try {
    const registro = this.usuariosRegistrados.find(
      (ur) => ur?.usuario?.toString?.() === userId.toString()
    );
    if (!registro) throw new Error('Usuario no encontrado en este slot');

    registro.estadoAprobacion = 'aprobado';
    registro.fechaAprobacion = new Date();
    registro.aprobadoPor = aprobadoPor;
    registro.motivoDesaprobacion = undefined;

    await this.save();
    return this;
  } catch (error) {
    console.error('Error aprobando usuario en slot:', error);
    throw error;
  }
};

// Método: Desaprobar Usuario
slotSchema.methods.desaprobarUsuario = async function (
  userId,
  motivo,
  desaprobadoPor
) {
  try {
    const registro = this.usuariosRegistrados.find(
      (ur) => ur?.usuario?.toString?.() === userId.toString()
    );
    if (!registro) throw new Error('Usuario no encontrado en este slot');

    registro.estadoAprobacion = 'desaprobado';
    registro.fechaAprobacion = new Date();
    registro.aprobadoPor = desaprobadoPor;
    registro.motivoDesaprobacion = motivo;

    await this.save();
    return this;
  } catch (error) {
    console.error('Error desaprobando usuario en slot:', error);
    throw error;
  }
};

// Método: Enviar correos de confirmación
slotSchema.methods.enviarCorreosConfirmacion = async function () {
  const { enviarCorreo } = require('../utils/mailer');
  const slot = this;

  await slot.populate('usuariosRegistrados.usuario');

  for (const registro of slot.usuariosRegistrados) {
    const user = registro.usuario;
    if (!user || !user.email) continue;

    const correoHtml = `
      <p>Hola ${user.nombre},</p>
      <p>Tu registro para el evento ha sido confirmado.</p>
      <p><strong>Fecha:</strong> ${slot.fecha.toLocaleDateString()}</p>
      <p><strong>Hora:</strong> ${slot.horaInicio} - ${slot.horaFin}</p>
      <p><strong>Enlace Meet:</strong> ${
        slot.enlaceMeet || 'Será enviado próximamente.'
      }</p>
      <p>Gracias por participar en el programa de promotoras.</p>
    `;

    try {
      await enviarCorreo({
        to: user.email,
        subject: 'Confirmación de Registro - Programa Promotoras',
        html: correoHtml,
      });
    } catch (err) {
      console.error(`❌ Error al enviar correo a ${user.email}:`, err.message);
    }
  }

  return true;
};

module.exports = mongoose.model('Slot', slotSchema);
