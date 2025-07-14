const express = require("express");
const router = express.Router();
const Slot = require("../models/Slot");
const ScheduleConfig = require("../models/ScheduleConfig");
const { startOfWeek, endOfWeek, addDays, format, startOfDay, endOfDay, parseISO } = require("date-fns");

// Función para generar cupos sin duplicados (copia de slots.js para uso interno)
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

// Ruta para limpiar todos los slots existentes
router.post("/clear-slots", async (req, res) => {
  try {
    await Slot.deleteMany({});
    res.json({ success: true, message: "Todos los slots han sido eliminados." });
  } catch (error) {
    console.error("Error al limpiar slots:", error);
    res.status(500).json({ success: false, message: "Error al limpiar slots", error: error.message });
  }
});

// Ruta para regenerar todos los slots basados en la configuración activa
router.post("/generate-all-slots", async (req, res) => {
  try {
    const config = await ScheduleConfig.findOne({ isActive: true });
    if (!config) {
      return res.status(404).json({ success: false, message: "No hay configuración de horarios activa." });
    }

    const startDate = new Date(config.startDate);
    const endDate = new Date(config.endDate);
    let totalSlotsGenerated = 0;

    // Iterar semana por semana para generar slots
    for (let d = new Date(startDate); d <= endDate; d = addWeeks(d, 1)) {
      const slots = await generateSlotsForWeek(format(d, 'yyyy-MM-dd'));
      totalSlotsGenerated += slots.length;
    }

    res.json({ success: true, message: `Se han generado ${totalSlotsGenerated} slots.`, generatedCount: totalSlotsGenerated });
  } catch (error) {
    console.error("Error al regenerar todos los slots:", error);
    res.status(500).json({ success: false, message: "Error al regenerar todos los slots", error: error.message });
  }
});

module.exports = router;


