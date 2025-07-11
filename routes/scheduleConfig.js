const express = require("express");
const router = express.Router();
const ScheduleConfig = require("../models/ScheduleConfig");
const Slot = require("../models/Slot");

// @route   GET api/schedule-config
// @desc    Obtener todas las configuraciones de horario
// @access  Public
router.get("/", async (req, res) => {
  try {
    const configs = await ScheduleConfig.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      data: configs
    });
  } catch (err) {
    console.error('Error obteniendo configuraciones:', err.message);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor"
    });
  }
});

// @route   GET api/schedule-config/active
// @desc    Obtener la configuración activa
// @access  Public
router.get("/active", async (req, res) => {
  try {
    let config = await ScheduleConfig.getActiveConfig();
    
    // Si no hay configuración activa, crear una por defecto
    if (!config) {
      console.log('No hay configuración activa, creando configuración por defecto');
      config = await ScheduleConfig.createDefaultConfig();
    }
    
    res.json({
      success: true,
      data: config
    });
  } catch (err) {
    console.error('Error obteniendo configuración activa:', err.message);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor"
    });
  }
});

// @route   POST api/schedule-config
// @desc    Crear una nueva configuración de horario
// @access  Public
router.post("/", async (req, res) => {
  const {
    name,
    startDate,
    endDate,
    allowedWeekDays,
    timeSlots,
    timeZone,
    isActive,
    autoCreateSlots,
    weeksInAdvance
  } = req.body;

  try {
    // Si se marca como activa, desactivar las demás
    if (isActive) {
      await ScheduleConfig.updateMany({}, { isActive: false });
    }

    const newConfig = new ScheduleConfig({
      name,
      startDate,
      endDate,
      allowedWeekDays,
      timeSlots,
      timeZone,
      isActive,
      autoCreateSlots,
      weeksInAdvance
    });

    const config = await newConfig.save();
    
    // Si autoCreateSlots está habilitado, generar slots automáticamente
    if (config.autoCreateSlots) {
      try {
        const slotsCreated = await config.generateSlots();
        console.log(`Se crearon ${slotsCreated.length} slots automáticamente`);
      } catch (slotError) {
        console.error('Error creando slots automáticamente:', slotError);
      }
    }
    
    res.json({
      success: true,
      message: "Configuración creada exitosamente",
      data: config
    });
  } catch (err) {
    console.error('Error creando configuración:', err.message);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: err.message
    });
  }
});

// @route   PUT api/schedule-config/:id
// @desc    Actualizar una configuración de horario
// @access  Public
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Si se marca como activa, desactivar las demás
    if (updateData.isActive) {
      await ScheduleConfig.updateMany({ _id: { $ne: id } }, { isActive: false });
    }

    const config = await ScheduleConfig.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!config) {
      return res.status(404).json({
        success: false,
        message: "Configuración no encontrada"
      });
    }

    res.json({
      success: true,
      message: "Configuración actualizada exitosamente",
      data: config
    });
  } catch (err) {
    console.error('Error actualizando configuración:', err.message);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: err.message
    });
  }
});

// @route   DELETE api/schedule-config/:id
// @desc    Eliminar una configuración de horario
// @access  Public
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const config = await ScheduleConfig.findById(id);
    if (!config) {
      return res.status(404).json({
        success: false,
        message: "Configuración no encontrada"
      });
    }

    // No permitir eliminar la configuración activa si es la única
    if (config.isActive) {
      const totalConfigs = await ScheduleConfig.countDocuments();
      if (totalConfigs === 1) {
        return res.status(400).json({
          success: false,
          message: "No se puede eliminar la única configuración activa"
        });
      }
    }

    await ScheduleConfig.findByIdAndDelete(id);

    // Eliminar slots asociados a esta configuración
    await Slot.deleteMany({ configId: id });

    res.json({
      success: true,
      message: "Configuración eliminada exitosamente"
    });
  } catch (err) {
    console.error('Error eliminando configuración:', err.message);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor"
    });
  }
});

// @route   POST api/schedule-config/:id/activate
// @desc    Activar una configuración específica
// @access  Public
router.post("/:id/activate", async (req, res) => {
  try {
    const { id } = req.params;

    // Desactivar todas las configuraciones
    await ScheduleConfig.updateMany({}, { isActive: false });

    // Activar la configuración específica
    const config = await ScheduleConfig.findByIdAndUpdate(
      id,
      { isActive: true },
      { new: true }
    );

    if (!config) {
      return res.status(404).json({
        success: false,
        message: "Configuración no encontrada"
      });
    }

    res.json({
      success: true,
      message: "Configuración activada exitosamente",
      data: config
    });
  } catch (err) {
    console.error('Error activando configuración:', err.message);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor"
    });
  }
});

// @route   POST api/schedule-config/:id/generate-slots
// @desc    Generar slots para una configuración específica
// @access  Public
router.post("/:id/generate-slots", async (req, res) => {
  try {
    const { id } = req.params;

    const config = await ScheduleConfig.findById(id);
    if (!config) {
      return res.status(404).json({
        success: false,
        message: "Configuración no encontrada"
      });
    }

    const slotsCreated = await config.generateSlots();

    res.json({
      success: true,
      message: `Se generaron ${slotsCreated.length} slots exitosamente`,
      data: {
        slotsCreated: slotsCreated.length,
        slots: slotsCreated
      }
    });
  } catch (err) {
    console.error('Error generando slots:', err.message);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: err.message
    });
  }
});

// @route   GET api/schedule-config/:id
// @desc    Obtener una configuración específica
// @access  Public
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const config = await ScheduleConfig.findById(id);
    if (!config) {
      return res.status(404).json({
        success: false,
        message: "Configuración no encontrada"
      });
    }

    res.json({
      success: true,
      data: config
    });
  } catch (err) {
    console.error('Error obteniendo configuración:', err.message);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor"
    });
  }
});

// @route   POST api/schedule-config/reset-default
// @desc    Resetear a configuración por defecto
// @access  Public
router.post("/reset-default", async (req, res) => {
  try {
    // Eliminar todas las configuraciones existentes
    await ScheduleConfig.deleteMany({});
    
    // Eliminar todos los slots existentes
    await Slot.deleteMany({});
    
    // Crear configuración por defecto
    const defaultConfig = await ScheduleConfig.createDefaultConfig();
    
    res.json({
      success: true,
      message: "Sistema reseteado a configuración por defecto",
      data: defaultConfig
    });
  } catch (err) {
    console.error('Error reseteando configuración:', err.message);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: err.message
    });
  }
});

module.exports = router;

