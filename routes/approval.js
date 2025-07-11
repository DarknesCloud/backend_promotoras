const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const nodemailer = require('nodemailer');

// Configurar nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// @route   GET api/approval/candidates
// @desc    Obtener candidatos que asistieron a reuniones
// @access  Admin
router.get('/candidates', async (req, res) => {
  try {
    const { estado, fechaInicio, fechaFin } = req.query;

    // Obtener usuarios que asistieron a reuniones
    const asistenciasPositivas = await Attendance.find({ asistio: true })
      .populate(
        'usuario',
        'nombre apellido email telefono estado fechaAprobacion aprobadoPor'
      )
      .populate('slot', 'fecha horaInicio horaFin');

    // Extraer usuarios únicos
    const usuariosMap = new Map();

    asistenciasPositivas.forEach((asistencia) => {
      const usuario = asistencia.usuario;
      if (!usuariosMap.has(usuario._id.toString())) {
        usuariosMap.set(usuario._id.toString(), {
          ...usuario.toObject(),
          reunionesAsistidas: [],
        });
      }

      usuariosMap.get(usuario._id.toString()).reunionesAsistidas.push({
        fecha: asistencia.slot.fecha,
        horaInicio: asistencia.slot.horaInicio,
        horaFin: asistencia.slot.horaFin,
        fechaMarcado: asistencia.fechaMarcado,
      });
    });

    let candidatos = Array.from(usuariosMap.values());

    // Filtrar por estado si se especifica
    if (estado) {
      candidatos = candidatos.filter(
        (candidato) => candidato.estado === estado
      );
    }

    // Filtrar por fecha si se especifica
    if (fechaInicio && fechaFin) {
      const inicio = new Date(fechaInicio);
      const fin = new Date(fechaFin);

      candidatos = candidatos.filter((candidato) =>
        candidato.reunionesAsistidas.some((reunion) => {
          const fechaReunion = new Date(reunion.fecha);
          return fechaReunion >= inicio && fechaReunion <= fin;
        })
      );
    }

    // Ordenar por fecha de última reunión asistida
    candidatos.sort((a, b) => {
      const fechaA = Math.max(
        ...a.reunionesAsistidas.map((r) => new Date(r.fecha))
      );
      const fechaB = Math.max(
        ...b.reunionesAsistidas.map((r) => new Date(r.fecha))
      );
      return fechaB - fechaA;
    });

    res.json({
      success: true,
      data: candidatos,
    });
  } catch (error) {
    console.error('Error obteniendo candidatos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
});

// @route   PUT api/approval/:userId/approve
// @desc    Aprobar un candidato
// @access  Admin
router.put('/:userId/approve', async (req, res) => {
  try {
    const { userId } = req.params;
    const { aprobadoPor } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    // Verificar que el usuario haya asistido a al menos una reunión
    const asistenciaPositiva = await Attendance.findOne({
      usuario: userId,
      asistio: true,
    });

    if (!asistenciaPositiva) {
      return res.status(400).json({
        success: false,
        message:
          'El usuario debe haber asistido a al menos una reunión para ser aprobado',
      });
    }

    // Aprobar usuario
    await user.aprobar(aprobadoPor);

    // Enviar correo de aprobación
    await enviarCorreoAprobacion(user);

    // Marcar que se envió el correo
    user.correoAprobacionEnviado = true;
    await user.save();

    res.json({
      success: true,
      message: 'Usuario aprobado exitosamente',
      data: user,
    });
  } catch (error) {
    console.error('Error aprobando usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
});

// @route   PUT api/approval/:userId/disapprove
// @desc    Desaprobar un candidato
// @access  Admin
router.put('/:userId/disapprove', async (req, res) => {
  try {
    const { userId } = req.params;
    const { motivo, desaprobadoPor } = req.body;

    if (!motivo) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere especificar el motivo de desaprobación',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    // Desaprobar usuario
    await user.desaprobar(motivo, desaprobadoPor);

    res.json({
      success: true,
      message: 'Usuario desaprobado exitosamente',
      data: user,
    });
  } catch (error) {
    console.error('Error desaprobando usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
});

// @route   DELETE api/approval/:userId/remove
// @desc    Eliminar un candidato de la base de datos
// @access  Admin
router.delete('/:userId/remove', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    // Eliminar registros de asistencia relacionados
    await Attendance.deleteMany({ usuario: userId });

    // Eliminar usuario
    await User.findByIdAndDelete(userId);

    res.json({
      success: true,
      message: 'Usuario eliminado exitosamente de la base de datos',
    });
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
});

// @route   GET api/approval/statistics
// @desc    Obtener estadísticas de aprobación
// @access  Admin
router.get('/statistics', async (req, res) => {
  try {
    const estadisticas = await User.aggregate([
      {
        $match: {
          estado: { $in: ['reunion_realizada', 'aprobado', 'desaprobado'] },
        },
      },
      {
        $group: {
          _id: '$estado',
          count: { $sum: 1 },
        },
      },
    ]);

    // Obtener usuarios que asistieron pero aún no han sido procesados
    const usuariosAsistieron = await Attendance.distinct('usuario', {
      asistio: true,
    });
    const usuariosPendientes = await User.find({
      _id: { $in: usuariosAsistieron },
      estado: { $nin: ['aprobado', 'desaprobado'] },
    }).countDocuments();

    const resultado = {
      aprobados: 0,
      desaprobados: 0,
      reunionRealizada: 0,
      pendientesAprobacion: usuariosPendientes,
    };

    estadisticas.forEach((stat) => {
      switch (stat._id) {
        case 'aprobado':
          resultado.aprobados = stat.count;
          break;
        case 'desaprobado':
          resultado.desaprobados = stat.count;
          break;
        case 'reunion_realizada':
          resultado.reunionRealizada = stat.count;
          break;
      }
    });

    res.json({
      success: true,
      data: resultado,
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas de aprobación:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
});

// @route   PUT api/approval/bulk-approve
// @desc    Aprobar múltiples candidatos
// @access  Admin
router.put('/bulk-approve', async (req, res) => {
  try {
    const { userIds, aprobadoPor } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un array de IDs de usuarios',
      });
    }

    const resultados = [];

    for (const userId of userIds) {
      try {
        const user = await User.findById(userId);
        if (user) {
          // Verificar asistencia
          const asistenciaPositiva = await Attendance.findOne({
            usuario: userId,
            asistio: true,
          });

          if (asistenciaPositiva) {
            await user.aprobar(aprobadoPor);
            await enviarCorreoAprobacion(user);
            user.correoAprobacionEnviado = true;
            await user.save();

            resultados.push({
              userId,
              success: true,
              message: 'Aprobado exitosamente',
            });
          } else {
            resultados.push({
              userId,
              success: false,
              message: 'Usuario no ha asistido a reuniones',
            });
          }
        } else {
          resultados.push({
            userId,
            success: false,
            message: 'Usuario no encontrado',
          });
        }
      } catch (error) {
        resultados.push({
          userId,
          success: false,
          message: error.message,
        });
      }
    }

    res.json({
      success: true,
      message: 'Aprobaciones procesadas',
      data: resultados,
    });
  } catch (error) {
    console.error('Error en aprobación masiva:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
});

// Función para enviar correo de aprobación
async function enviarCorreoAprobacion(user) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: user.email,
    subject:
      '¡Felicitaciones! Has sido aprobada para el Programa de Promotoras',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #ED1F80; text-align: center;">¡Felicitaciones!</h2>
        
        <p>Estimada <strong>${user.nombre} ${user.apellido}</strong>,</p>
        
        <p>Nos complace informarte que has sido <strong>aprobada</strong> para participar en nuestro Programa de Promotoras.</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #ED1F80; margin-top: 0;">Próximos pasos:</h3>
          <p>✅ <strong>Prepárate para trabajar:</strong> Revisa toda la información que te hemos proporcionado sobre el programa.</p>
          <p>✅ <strong>Mantente atenta:</strong> Recibirás una confirmación por WhatsApp indicando el día exacto que debes presentarte.</p>
          <p>✅ <strong>Documentación:</strong> Ten listos todos los documentos requeridos para tu primer día.</p>
        </div>
        
        <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
          <p style="margin: 0;"><strong>¡Importante!</strong> Estaremos en contacto contigo muy pronto por WhatsApp para coordinar tu fecha de inicio.</p>
        </div>
        
        <p>Estamos emocionados de tenerte en nuestro equipo y esperamos que esta sea una experiencia exitosa y enriquecedora para ti.</p>
        
        <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
        
        <p>¡Bienvenida al equipo!</p>
        
        <p style="margin-top: 30px;">
          <strong>Equipo del Programa de Promotoras</strong>
        </p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
        <p style="color: #666; font-size: 12px; text-align: center;">
          Este es un correo automático, por favor no respondas a este mensaje.
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Correo de aprobación enviado a: ${user.email}`);
  } catch (error) {
    console.error('Error enviando correo de aprobación:', error);
    throw error;
  }
}

module.exports = router;
