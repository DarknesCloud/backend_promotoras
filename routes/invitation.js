const express = require('express');
const router = express.Router();
const User = require('../models/User');
const nodemailer = require('nodemailer');

// Configurar nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// @route   GET api/invitation/validate-email/:email
// @desc    Validar si el email existe en la base de datos y obtener datos del usuario
// @access  Public
router.get('/validate-email/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    // Buscar el usuario por email
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado con este correo electrónico'
      });
    }

    // Retornar datos básicos del usuario
    res.json({
      success: true,
      data: {
        email: user.email,
        nombre: user.nombre,
        apellido: user.apellido,
        idioma: user.idioma || 'Español'
      }
    });
  } catch (error) {
    console.error('Error validando email:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// @route   POST api/invitation/schedule-appointment
// @desc    Actualizar usuario con datos de la cita y generar enlace de Google Meet
// @access  Public
router.post('/schedule-appointment', async (req, res) => {
  try {
    const { email, idioma, fechaCita, horaCita } = req.body;

    // Validar datos requeridos
    if (!email || !idioma || !fechaCita || !horaCita) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos son requeridos'
      });
    }

    // Buscar el usuario
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Generar enlace de Google Meet (simulado)
    const meetId = generateMeetId();
    const meetLink = `https://meet.google.com/${meetId}`;

    // Actualizar usuario con los nuevos datos
    const updatedUser = await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      {
        idioma,
        fechaCita: new Date(fechaCita),
        horaCita,
        enlaceMeet: meetLink
      },
      { new: true }
    );

    // Enviar correo de confirmación con el enlace de Meet
    await sendConfirmationEmail(updatedUser, meetLink);

    res.json({
      success: true,
      message: 'Cita agendada exitosamente',
      data: {
        email: updatedUser.email,
        fechaCita: updatedUser.fechaCita,
        horaCita: updatedUser.horaCita,
        enlaceMeet: updatedUser.enlaceMeet,
        idioma: updatedUser.idioma
      }
    });
  } catch (error) {
    console.error('Error agendando cita:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Función para generar ID de Google Meet (simulado)
function generateMeetId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  let result = '';
  
  // Formato: xxx-xxxx-xxx
  for (let i = 0; i < 3; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  result += '-';
  
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  result += '-';
  
  for (let i = 0; i < 3; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}

// Función para enviar correo de confirmación
async function sendConfirmationEmail(user, meetLink) {
  const fechaFormateada = new Date(user.fechaCita).toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: user.email,
    subject: 'Confirmación de cita - Programa de Promotoras',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #ED1F80; text-align: center;">¡Cita Confirmada!</h2>
        
        <p>Hola <strong>${user.nombre} ${user.apellido}</strong>,</p>
        
        <p>Tu cita para el programa de promotoras ha sido confirmada exitosamente.</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #ED1F80; margin-top: 0;">Detalles de tu cita:</h3>
          <p><strong>Fecha:</strong> ${fechaFormateada}</p>
          <p><strong>Hora:</strong> ${user.horaCita}</p>
          <p><strong>Idioma:</strong> ${user.idioma}</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${meetLink}" 
             style="background-color: #ED1F80; color: white; padding: 15px 30px; 
                    text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            Unirse a la reunión
          </a>
        </div>
        
        <p><strong>Enlace de la reunión:</strong> <a href="${meetLink}">${meetLink}</a></p>
        
        <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Importante:</strong> Guarda este correo y únete a la reunión 5 minutos antes de la hora programada.</p>
        </div>
        
        <p>Si tienes alguna pregunta o necesitas reprogramar tu cita, no dudes en contactarnos.</p>
        
        <p>¡Esperamos verte pronto!</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
        <p style="color: #666; font-size: 12px; text-align: center;">
          Este es un correo automático, por favor no respondas a este mensaje.
        </p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Correo de confirmación enviado a: ${user.email}`);
  } catch (error) {
    console.error('Error enviando correo de confirmación:', error);
    throw error;
  }
}

module.exports = router;

