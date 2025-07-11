const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Slot = require('../models/Slot');

// Validación personalizada más flexible
const validateUserData = (req, res, next) => {
  const { nombre, apellido, email } = req.body;
  const errors = [];

  if (!nombre || nombre.trim() === '') {
    errors.push('El nombre es obligatorio');
  }

  if (!apellido || apellido.trim() === '') {
    errors.push('El apellido es obligatorio');
  }

  if (!email || email.trim() === '') {
    errors.push('El email es obligatorio');
  } else {
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      errors.push('El formato del email no es válido');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Errores de validación',
      errors,
    });
  }

  next();
};

// Crear nuevo usuario y registrarlo en un cupo
router.post('/', validateUserData, async (req, res) => {
  try {
    const { email, slotId, idiomas, idioma } = req.body;

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un usuario con este email',
      });
    }

    const userData = { ...req.body };
    userData.email = email.toLowerCase();

    if (idiomas && Array.isArray(idiomas) && idiomas.length > 0) {
      userData.idiomas = idiomas;
      userData.idioma = idiomas[0];
    } else if (idioma) {
      userData.idiomas = [idioma];
      userData.idioma = idioma;
    } else {
      userData.idiomas = ['Español'];
      userData.idioma = 'Español';
    }

    const user = new User(userData);
    await user.save();

    if (slotId) {
      try {
        const slot = await Slot.findById(slotId);
        if (!slot) {
          return res.status(404).json({
            success: false,
            message: 'Cupo no encontrado',
          });
        }

        await slot.registrarUsuario(user._id);

        user.slot = slotId;
        user.estado = 'agendado';
        await user.save();

        const updatedSlot = await Slot.findById(slotId).populate(
          'usuariosRegistrados'
        );

        try {
          await updatedSlot.enviarCorreosConfirmacion();
        } catch (emailError) {
          console.error('❌ Error enviando correos:', emailError);
        }

        const populatedUser = await User.findById(user._id).populate('slot');

        return res.status(201).json({
          success: true,
          message: 'Usuario de invitación creado y registrado exitosamente',
          data: populatedUser,
        });
      } catch (slotError) {
        await User.findByIdAndDelete(user._id);
        throw slotError;
      }
    } else {
      return res.status(201).json({
        success: true,
        message: 'Usuario de invitación creado exitosamente',
        data: user,
      });
    }
  } catch (error) {
    console.error('❌ Error creando usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message,
    });
  }
});

// Crear usuario desde invitación (campos mínimos)
router.post('/invitation', async (req, res) => {
  try {
    const { email, slotId, idiomas, idioma } = req.body;

    if (!email || email.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'El email es obligatorio',
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un usuario con este email',
      });
    }

    const userData = {
      nombre: req.body.nombre || '',
      apellido: req.body.apellido || '',
      email: email.toLowerCase(),
      esImportado: true,
      estado: 'pendiente',
    };

    if (idiomas && Array.isArray(idiomas) && idiomas.length > 0) {
      userData.idiomas = idiomas;
      userData.idioma = idiomas[0];
    } else if (idioma) {
      userData.idiomas = [idioma];
      userData.idioma = idioma;
    } else {
      userData.idiomas = ['Español'];
      userData.idioma = 'Español';
    }

    const user = new User(userData);
    await user.save();

    if (slotId) {
      try {
        const slot = await Slot.findById(slotId);
        if (!slot) {
          return res.status(404).json({
            success: false,
            message: 'Cupo no encontrado',
          });
        }

        await slot.registrarUsuario(user._id);
        user.slot = slotId;
        user.estado = 'agendado';
        await user.save();

        try {
          const finalSlot = await Slot.findById(slotId).populate(
            'usuariosRegistrados'
          );
          await finalSlot.enviarCorreosConfirmacion();
        } catch (emailError) {
          console.error('❌ Error enviando correos:', emailError);
        }
      } catch (slotError) {
        console.error('❌ Error en el slot:', slotError);
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Usuario de invitación creado exitosamente',
      data: user,
    });
  } catch (error) {
    console.error('❌ Error creando usuario de invitación:', error);
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
    const { estado, slot, page = 1, limit = 50 } = req.query;

    const filtro = {};
    if (estado) filtro.estado = estado;
    if (slot) filtro.slot = slot;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(filtro)
      .populate('slot', 'fecha horaInicio horaFin enlaceMeet estado')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(filtro);

    res.json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
});

// Obtener un usuario específico
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('slot');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
});

// Actualizar un usuario
router.put('/:id', async (req, res) => {
  try {
    const { idiomas, idioma } = req.body;
    const updateData = { ...req.body };

    if (idiomas && Array.isArray(idiomas) && idiomas.length > 0) {
      updateData.idiomas = idiomas;
      updateData.idioma = idiomas[0];
    } else if (idioma) {
      updateData.idiomas = [idioma];
      updateData.idioma = idioma;
    }

    const user = await User.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    }).populate('slot');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
});

// Eliminar un usuario
router.delete('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    if (user.slot) {
      try {
        const slot = await Slot.findById(user.slot);
        if (slot) {
          await slot.removerUsuario(user._id);
        }
      } catch (slotError) {
        console.error('Error removiendo usuario del slot:', slotError);
      }
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Usuario eliminado exitosamente',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
});

// Aprobar un usuario
router.post('/:id/approve', async (req, res) => {
  try {
    const { aprobadoPor } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    await user.aprobar(aprobadoPor || 'Administrador');

    res.json({
      success: true,
      message: 'Usuario aprobado exitosamente',
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
});

// Desaprobar un usuario
router.post('/:id/reject', async (req, res) => {
  try {
    const { motivo, desaprobadoPor } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    await user.desaprobar(
      motivo || 'No especificado',
      desaprobadoPor || 'Administrador'
    );

    res.json({
      success: true,
      message: 'Usuario desaprobado exitosamente',
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
});



module.exports = router;

