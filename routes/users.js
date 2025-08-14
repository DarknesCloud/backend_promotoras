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
    const { email, slotId, idiomas, idioma, videoWatched, photoUrl } = req.body;

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un usuario con este email',
      });
    }

    const userData = { ...req.body };
    userData.email = email.toLowerCase();
    userData.videoWatched = videoWatched || false;
    userData.photoUrl = photoUrl || null;

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



    });
  }
});

// Obtener un usuario por email
router.get("/email/:email", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado",
      });
    }
    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Error obteniendo usuario por email:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
    });
  }
});

// Actualizar photoUrl de un usuario por email
router.put("/email/:email/photo", async (req, res) => {
  try {
    const { photoUrl } = req.body;
    const user = await User.findOneAndUpdate(
      { email: req.params.email.toLowerCase() },
      { photoUrl: photoUrl },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado",
      });
    }
    res.json({
      success: true,
      message: "Photo URL actualizada exitosamente",
      data: user,
    });
  } catch (error) {
    console.error("Error actualizando photo URL:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
    });
  }
});

// Actualizar videoWatched de un usuario por email
router.put("/email/:email/video", async (req, res) => {
  try {
    const { videoWatched } = req.body;
    const user = await User.findOneAndUpdate(
      { email: req.params.email.toLowerCase() },
      { videoWatched: videoWatched },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado",
      });
    }
    res.json({
      success: true,
      message: "Estado de video actualizado exitosamente",
      data: user,
    });
  } catch (error) {
    console.error("Error actualizando estado de video:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
    });
  }
});

module.exports = router;

// Generar un token único para un usuario (si no tiene uno)
router.post("/email/:email/generate-token", async (req, res) => {
  try {
    const email = req.params.email.toLowerCase();
    let user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado",
      });
    }

    if (!user.token) {
      user.token = require("crypto").randomBytes(20).toString("hex");
      await user.save();
    }

    res.json({
      success: true,
      message: "Token generado/existente para el usuario",
      token: user.token,
    });
  } catch (error) {
    console.error("Error generando token para usuario:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
    });
  }
});

// Obtener un usuario por token
router.get("/token/:token", async (req, res) => {
  try {
    const user = await User.findOne({ token: req.params.token });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado",
      });
    }
    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Error obteniendo usuario por token:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
    });
  }
});

// Actualizar photoUrl de un usuario por token
router.put("/token/:token/photo", async (req, res) => {
  try {
    const { photoUrl } = req.body;
    const user = await User.findOneAndUpdate(
      { token: req.params.token },
      { photoUrl: photoUrl },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado",
      });
    }
    res.json({
      success: true,
      message: "Photo URL actualizada exitosamente por token",
      data: user,
    });
  } catch (error) {
    console.error("Error actualizando photo URL por token:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
    });
  }
});

// Actualizar videoWatched de un usuario por token
router.put("/token/:token/video", async (req, res) => {
  try {
    const { videoWatched } = req.body;
    const user = await User.findOneAndUpdate(
      { token: req.params.token },
      { videoWatched: videoWatched },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado",
      });
    }
    res.json({
      success: true,
      message: "Estado de video actualizado exitosamente por token",
      data: user,
    });
  } catch (error) {
    console.error("Error actualizando estado de video por token:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
    });
  }
});

// Obtener todos los usuarios con sus tokens (para la página de generación de enlaces)
router.get("/with-tokens", async (req, res) => {
  try {
    const users = await User.find({}, "nombre apellido email videoWatched photoUrl token createdAt");
    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error("Error obteniendo usuarios con tokens:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
    });
  }
});

