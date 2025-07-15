const express = require("express");
const router = express.Router();
const Slot = require("../models/Slot");
const User = require("../models/User");
const ScheduleConfig = require("../models/ScheduleConfig");
const { startOfWeek, endOfWeek, addDays, format, startOfDay, endOfDay, parseISO } = require("date-fns");

// Función mejorada para generar cupos sin duplicados
const generateSlotsForWeek = async (startDate) => {
  try {
    console.log("🔄 Generando cupos para la semana:", startDate);
    
    // Obtener configuración activa
    let config = await ScheduleConfig.findOne({ isActive: true });
    if (!config) {
      console.log("❌ No hay configuración activa, creando configuración por defecto...");
      
      // Crear configuración por defecto
      const defaultConfig = new ScheduleConfig({
        name: "Configuración Principal",
        startDate: new Date(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 días
        allowedWeekDays: [1, 2, 3, 4, 5], // Lunes a Viernes
        timeSlots: [
          { startTime: "09:00", endTime: "10:00", duration: 60, capacity: 15 },
          { startTime: "10:00", endTime: "11:00", duration: 60, capacity: 15 },
          { startTime: "16:00", endTime: "17:00", duration: 60, capacity: 15 },
          { startTime: "17:00", endTime: "18:00", duration: 60, capacity: 15 },
          { startTime: "18:00", endTime: "19:00", duration: 60, capacity: 15 }
        ],
        isActive: true,
        autoCreateSlots: true,
        weeksInAdvance: 4
      });
      
      await defaultConfig.save();
      config = defaultConfig;
      console.log("✅ Configuración por defecto creada");
    }

    const weekStart = startOfWeek(parseISO(startDate), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const slotsCreated = [];

    console.log(`📅 Generando cupos desde ${format(weekStart, "yyyy-MM-dd")} hasta ${format(weekEnd, "yyyy-MM-dd")}`);

    // Verificar que la fecha esté dentro del rango de configuración
    if (weekStart < new Date(config.startDate) || weekStart > new Date(config.endDate)) {
      console.log("⚠️ La semana solicitada está fuera del rango de configuración");
      return [];
    }

    // Obtener todos los cupos existentes para esta semana de una vez
    const existingSlots = await Slot.find({
      fecha: {
        $gte: startOfDay(weekStart),
        $lte: endOfDay(weekEnd)
      }
    });

    // Crear un mapa de cupos existentes para búsqueda rápida
    const existingSlotsMap = new Map();
    existingSlots.forEach(slot => {
      const key = `${format(slot.fecha, "yyyy-MM-dd")}_${slot.horaInicio}`;
      existingSlotsMap.set(key, slot);
    });

    // Generar cupos para cada día permitido
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const currentDate = addDays(weekStart, dayOffset);
      const dayOfWeek = currentDate.getDay();
      
      // Ajustar dayOfWeek para que 0 sea Domingo, 1 Lunes, etc.
      const adjustedDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek; 

      // Verificar si es día permitido
      if (!config.allowedWeekDays.includes(adjustedDayOfWeek)) {
        continue;
      }

      // Generar cupos para cada franja horaria
      for (const timeSlot of config.timeSlots) {
        const dateKey = format(currentDate, "yyyy-MM-dd");
        const slotKey = `${dateKey}_${timeSlot.startTime}`;
        
        // Verificar si ya existe usando el mapa
        if (!existingSlotsMap.has(slotKey)) {
          try {
            const newSlot = new Slot({
              fecha: currentDate,
              horaInicio: timeSlot.startTime,
              horaFin: timeSlot.endTime,
              capacidadMaxima: timeSlot.capacity,
              usuariosRegistrados: [],
              estado: "disponible",
              configId: config._id
            });

            await newSlot.save();
            slotsCreated.push(newSlot);
            console.log(`✅ Cupo creado: ${dateKey} ${timeSlot.startTime}-${timeSlot.endTime}`);
          } catch (saveError) {
            // Si hay error de duplicado, simplemente continuar
            if (saveError.code === 11000) {
              console.log(`⚠️ Cupo ya existe: ${dateKey} ${timeSlot.startTime}-${timeSlot.endTime}`);
            } else {
              console.error(`❌ Error creando cupo ${dateKey} ${timeSlot.startTime}:`, saveError.message);
            }
          }
        } else {
          console.log(`ℹ️ Cupo ya existe: ${dateKey} ${timeSlot.startTime}-${timeSlot.endTime}`);
        }
      }
    }

    console.log(`🎯 Total de cupos creados: ${slotsCreated.length}`);
    return slotsCreated;
  } catch (error) {
    console.error("❌ Error generando cupos:", error);
    throw error;
  }
};

// GET /api/slots/week/:startDate - Obtener cupos de una semana
router.get("/week/:startDate", async (req, res) => {
  try {
    const { startDate } = req.params;
    console.log("📅 Solicitando cupos para la semana:", startDate);

    const weekStart = startOfWeek(parseISO(startDate), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

    console.log("🔍 Buscando cupos entre:", format(weekStart, "yyyy-MM-dd"), "y", format(weekEnd, "yyyy-MM-dd"));

    // Buscar cupos existentes primero
    let slots = await Slot.find({
      fecha: {
        $gte: startOfDay(weekStart),
        $lte: endOfDay(weekEnd)
      }
    }).sort({ fecha: 1, horaInicio: 1 });

    // Si no hay cupos, intentar generarlos automáticamente
    if (slots.length === 0) {
      console.log("🔄 No hay cupos existentes, generando automáticamente...");
      await generateSlotsForWeek(startDate);
      
      // Buscar cupos nuevamente después de la generación
      slots = await Slot.find({
        fecha: {
          $gte: startOfDay(weekStart),
          $lte: endOfDay(weekEnd)
        }
      }).sort({ fecha: 1, horaInicio: 1 });
    }

    res.json({
      success: true,
      data: slots,
      message: `${slots.length} cupos encontrados para la semana`
    });

  } catch (error) {
    console.error("❌ Error obteniendo cupos de la semana:", error);
    res.status(500).json({
      success: false,
      message: "Error obteniendo cupos de la semana",
      error: error.message
    });
  }
});

// POST /api/slots/generate-week - Generar cupos para una semana específica
router.post("/generate-week", async (req, res) => {
  try {
    const { startDate } = req.body;
    console.log("🔄 Solicitud de generación de cupos para:", startDate);

    const slotsCreated = await generateSlotsForWeek(startDate);

    res.json({
      success: true,
      data: slotsCreated,
      message: `${slotsCreated.length} cupos generados exitosamente`
    });

  } catch (error) {
    console.error("❌ Error generando cupos:", error);
    res.status(500).json({
      success: false,
      message: "Error generando cupos",
      error: error.message
    });
  }
});

// GET /api/slots - Obtener todos los cupos
router.get("/", async (req, res) => {
  try {
    const slots = await Slot.find().sort({ fecha: 1, horaInicio: 1 });
    
    res.json({
      success: true,
      data: slots,
      message: `${slots.length} cupos encontrados`
    });

  } catch (error) {
    console.error("❌ Error obteniendo cupos:", error);
    res.status(500).json({
      success: false,
      message: "Error obteniendo cupos",
      error: error.message
    });
  }
});

// POST /api/slots/:id/register - Registrar usuario en un cupo
router.post("/:id/register", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const slot = await Slot.findById(id);
    if (!slot) {
      return res.status(404).json({
        success: false,
        message: "Cupo no encontrado"
      });
    }

    // Verificar si el cupo está disponible
    if (slot.usuariosRegistrados.length >= slot.capacidadMaxima) {
      return res.status(400).json({
        success: false,
        message: "El cupo está lleno"
      });
    }

    // Verificar si el usuario ya está registrado
    if (slot.usuariosRegistrados.includes(userId)) {
      return res.status(400).json({
        success: false,
        message: "El usuario ya está registrado en este cupo"
      });
    }

    // Registrar usuario
    slot.usuariosRegistrados.push(userId);
    
    // Actualizar estado si está lleno
    if (slot.usuariosRegistrados.length >= slot.capacidadMaxima) {
      slot.estado = "lleno";
    }

    await slot.save();

    res.json({
      success: true,
      data: slot,
      message: "Usuario registrado exitosamente en el cupo"
    });

  } catch (error) {
    console.error("❌ Error registrando usuario en cupo:", error);
    res.status(500).json({
      success: false,
      message: "Error registrando usuario en cupo",
      error: error.message
    });
  }
});

// GET /api/slots/today - Obtener cupos de hoy
router.get("/today", async (req, res) => {
  try {
    const today = new Date();
    const slots = await Slot.find({
      fecha: {
        $gte: startOfDay(today),
        $lte: endOfDay(today)
      }
    }).populate("usuariosRegistrados", "nombre apellido email").sort({ horaInicio: 1 });

    res.json({
      success: true,
      data: slots,
      message: `${slots.length} citas encontradas para hoy`
    });

  } catch (error) {
    console.error("❌ Error obteniendo citas de hoy:", error);
    res.status(500).json({
      success: false,
      message: "Error obteniendo citas de hoy",
      error: error.message
    });
  }
});

module.exports = router;



// POST /api/slots/:id/generate-meet - Generar enlace de Google Meet y enviar correos
router.post("/:id/generate-meet", async (req, res) => {
  try {
    const { id } = req.params;

    const slot = await Slot.findById(id).populate('usuariosRegistrados.usuario');
    if (!slot) {
      return res.status(404).json({
        success: false,
        message: "Cupo no encontrado"
      });
    }

    // Verificar si el slot tiene usuarios registrados
    if (slot.usuariosRegistrados.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No hay usuarios registrados en este cupo"
      });
    }

    // Generar enlace de Google Meet
    try {
      await slot.generarEnlaceMeet();
      console.log("✅ Enlace de Google Meet generado exitosamente");
    } catch (meetError) {
      console.error("❌ Error generando enlace de Meet:", meetError);
      return res.status(500).json({
        success: false,
        message: "Error generando enlace de Google Meet",
        error: meetError.message
      });
    }

    // Enviar correos de confirmación
    try {
      await slot.enviarCorreosConfirmacion();
      console.log("✅ Correos de confirmación enviados exitosamente");
    } catch (emailError) {
      console.error("❌ Error enviando correos:", emailError);
      // No fallar completamente si los emails fallan
      console.log("⚠️ Enlace de Meet generado pero algunos correos pueden no haberse enviado");
    }

    // Recargar el slot para obtener los datos actualizados
    const updatedSlot = await Slot.findById(id).populate('usuariosRegistrados.usuario');

    res.json({
      success: true,
      data: updatedSlot,
      message: "Enlace de Google Meet generado y correos enviados exitosamente"
    });

  } catch (error) {
    console.error("❌ Error en generate-meet:", error);
    res.status(500).json({
      success: false,
      message: "Error generando enlace de Meet y enviando correos",
      error: error.message
    });
  }
});


// DELETE /api/slots/:id - Eliminar un slot completo
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const slot = await Slot.findById(id);
    if (!slot) {
      return res.status(404).json({
        success: false,
        message: "Cupo no encontrado"
      });
    }

    // Verificar si el slot tiene usuarios registrados
    if (slot.usuariosRegistrados.length > 0) {
      return res.status(400).json({
        success: false,
        message: `No se puede eliminar el cupo porque tiene ${slot.usuariosRegistrados.length} usuario(s) registrado(s)`
      });
    }

    await Slot.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Cupo eliminado exitosamente"
    });

  } catch (error) {
    console.error("❌ Error eliminando cupo:", error);
    res.status(500).json({
      success: false,
      message: "Error eliminando cupo",
      error: error.message
    });
  }
});

// GET /api/slots/filled - Obtener slots llenos
router.get("/filled", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let query = { estado: "lleno" };
    
    if (startDate && endDate) {
      query.fecha = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const filledSlots = await Slot.find(query)
      .populate('usuariosRegistrados.usuario', 'nombre apellido email telefono estado')
      .sort({ fecha: 1, horaInicio: 1 });

    res.json({
      success: true,
      data: filledSlots,
      message: `${filledSlots.length} cupos llenos encontrados`
    });

  } catch (error) {
    console.error("❌ Error obteniendo cupos llenos:", error);
    res.status(500).json({
      success: false,
      message: "Error obteniendo cupos llenos",
      error: error.message
    });
  }
});



// PUT /api/slots/:slotId/user/:userId/approve - Aprobar usuario en un slot
router.put("/:slotId/user/:userId/approve", async (req, res) => {
  try {
    const { slotId, userId } = req.params;
    const { aprobadoPor } = req.body;

    const slot = await Slot.findById(slotId);
    if (!slot) {
      return res.status(404).json({
        success: false,
        message: "Slot no encontrado"
      });
    }

    // Aprobar usuario usando el método del modelo
    await slot.aprobarUsuario(userId, aprobadoPor || 'Admin');

    // Recargar el slot con los datos actualizados
    const updatedSlot = await Slot.findById(slotId).populate('usuariosRegistrados.usuario');

    res.json({
      success: true,
      data: updatedSlot,
      message: "Usuario aprobado exitosamente"
    });

  } catch (error) {
    console.error("❌ Error aprobando usuario:", error);
    res.status(500).json({
      success: false,
      message: "Error aprobando usuario",
      error: error.message
    });
  }
});

// GET /api/slots/attendance-lists - Obtener listas de asistencia
router.get("/attendance-lists", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let query = {};
    
    if (startDate && endDate) {
      query.fecha = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const slots = await Slot.find(query)
      .populate('usuariosRegistrados.usuario', 'nombre apellido email telefono estado')
      .sort({ fecha: 1, horaInicio: 1 });

    // Procesar datos para crear listas de asistencia
    const attendanceLists = {
      attended: [],
      absent: [],
      pending: []
    };

    slots.forEach(slot => {
      slot.usuariosRegistrados.forEach(registro => {
        const user = registro.usuario;
        const slotInfo = {
          slotId: slot._id,
          fecha: slot.fecha,
          horaInicio: slot.horaInicio,
          horaFin: slot.horaFin,
          user: {
            _id: user._id,
            nombre: user.nombre,
            apellido: user.apellido,
            email: user.email,
            telefono: user.telefono,
            estado: user.estado
          },
          estadoAprobacion: registro.estadoAprobacion,
          fechaRegistro: registro.fechaRegistro
        };

        // Por ahora, todos van a pending ya que no tenemos sistema de asistencia implementado
        // En el futuro, esto se basará en los datos reales de asistencia
        attendanceLists.pending.push(slotInfo);
      });
    });

    res.json({
      success: true,
      data: attendanceLists,
      message: "Listas de asistencia obtenidas exitosamente"
    });

  } catch (error) {
    console.error("❌ Error obteniendo listas de asistencia:", error);
    res.status(500).json({
      success: false,
      message: "Error obteniendo listas de asistencia",
      error: error.message
    });
  }
});

