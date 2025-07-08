const express = require('express');
const router = express.Router();
const User = require('../models/User');
const ApprovedUser = require('../models/ApprovedUser');
const { validateUser } = require('../middleware/validation');

// Crear nuevo usuario
router.post('/', validateUser, async (req, res) => {
  try {
    const { email } = req.body;

    // Verificar si el email ya existe
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un usuario con este email',
      });
    }

    const user = new User(req.body);
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: user,
    });
  } catch (error) {
    console.error('Error creando usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message,
    });
  }
});

// Obtener todos los usuarios
router.get('/', async (req, res) => {
  try {
    const users = await User.find().sort({ fechaCreacion: -1 });
    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
});

// Obtener usuarios del día actual
router.get('/today', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const users = await User.find({
      fechaCita: {
        $gte: today,
        $lt: tomorrow,
      },
    }).sort({ horaCita: 1 });

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error('Error obteniendo usuarios del día:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
});

// Aprobar usuario
router.post('/:id/approve', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    // Crear usuario aprobado
    const approvedUser = new ApprovedUser({
      nombre: user.nombre,
      apellido: user.apellido,
      email: user.email,
      telefono: user.telefono,
      edad: user.edad,
      ciudad: user.ciudad,
      experiencia: user.experiencia,
      motivacion: user.motivacion,
      disponibilidad: user.disponibilidad,
      fechaCita: user.fechaCita,
      horaCita: user.horaCita,
      enlaceMeet: user.enlaceMeet,
      idioma: user.idioma,
      originalUserId: user._id,
    });

    await approvedUser.save();
    await User.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Usuario aprobado exitosamente',
      data: approvedUser,
    });
  } catch (error) {
    console.error('Error aprobando usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
});

// Eliminar usuario
router.delete('/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    res.json({
      success: true,
      message: 'Usuario eliminado exitosamente',
    });
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
});

// Obtener usuarios aprobados
router.get('/approved', async (req, res) => {
  try {
    const approvedUsers = await ApprovedUser.find().sort({
      fechaAprobacion: -1,
    });
    res.json({
      success: true,
      data: approvedUsers,
    });
  } catch (error) {
    console.error('Error obteniendo usuarios aprobados:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
});

// Eliminar usuario aprobado
router.delete('/approved/:id', async (req, res) => {
  try {
    const approvedUser = await ApprovedUser.findByIdAndDelete(req.params.id);
    if (!approvedUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario aprobado no encontrado',
      });
    }

    res.json({
      success: true,
      message: 'Usuario aprobado eliminado exitosamente',
    });
  } catch (error) {
    console.error('Error eliminando usuario aprobado:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
});

// Importar usuarios desde JSON
router.post('/import', async (req, res) => {
  try {
    const { users } = req.body;

    if (!users || !Array.isArray(users)) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un array de usuarios',
      });
    }

    const importedUsers = [];
    const errors = [];

    for (let i = 0; i < users.length; i++) {
      try {
        const userData = users[i];

        // Verificar si el email ya existe
        const existingUser = await User.findOne({
          email: userData.email?.toLowerCase(),
        });
        if (existingUser) {
          errors.push(`Fila ${i + 1}: Email ${userData.email} ya existe`);
          continue;
        }

        // Validar datos básicos
        if (!userData.email || !userData.nombre || !userData.apellido) {
          errors.push(`Fila ${i + 1}: Faltan campos obligatorios`);
          continue;
        }

        // Validar edad
        if (userData.edad < 18 || userData.edad > 100) {
          errors.push(`Fila ${i + 1}: Edad debe estar entre 18 y 100 años`);
          continue;
        }

        const user = new User({
          ...userData,
          esImportado: true,
        });

        await user.save();
        importedUsers.push(user);
      } catch (error) {
        errors.push(`Fila ${i + 1}: ${error.message}`);
      }
    }

    res.json({
      success: true,
      message: `Importación completada. ${importedUsers.length} usuarios importados`,
      data: {
        imported: importedUsers.length,
        errors: errors.length,
        errorDetails: errors,
      },
    });
  } catch (error) {
    console.error('Error importando usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
});

// Actualizar usuario por correo electrónico
router.put('/update-by-email', async (req, res) => {
  try {
    const { correo, fechaCita, horaCita, meetLink, idioma } = req.body;

    const updatedUser = await User.findOneAndUpdate(
      { email: correo.toLowerCase() },
      {
        fechaCita,
        horaCita,
        enlaceMeet: meetLink,
        idioma,
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado con ese correo',
      });
    }

    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: updatedUser,
    });
  } catch (error) {
    console.error('Error actualizando usuario por correo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message,
    });
  }
});

module.exports = router;
