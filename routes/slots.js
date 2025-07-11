const express = require('express');
const router = express.Router();
const Slot = require('../models/Slot');
const User = require('../models/User');
const ScheduleConfig = require('../models/ScheduleConfig');
const { startOfWeek, endOfWeek, addDays, format, startOfDay, endOfDay, parseISO } = require('date-fns');

// Función simplificada para generar cupos
const generateSlotsForWeek = async (startDate) => {
  try {
    console.log('🔄 Generando cupos para la semana:', startDate);
    
    // Obtener configuración activa
    const config = await ScheduleConfig.findOne({ isActive: true });
    if (!config) {
      console.log('❌ No hay configuración activa, creando configuración por defecto...');
      
      // Crear configuración por defecto
      const defaultConfig = new ScheduleConfig({
        name: 'Configuración Principal',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
        allowedWeekDays: [1, 2, 3, 4, 5], // Lunes a Viernes
        timeSlots: [
          { startTime: '09:00', endTime: '09:30', duration: 30, capacity: 15 },
          { startTime: '09:30', endTime: '10:00', duration: 30, capacity: 15 },
          { startTime: '10:00', endTime: '10:30', duration: 30, capacity: 15 },
          { startTime: '10:30', endTime: '11:00', duration: 30, capacity: 15 },
          { startTime: '16:00', endTime: '16:30', duration: 30, capacity: 15 },
          { startTime: '16:30', endTime: '17:00', duration: 30, capacity: 15 },
          { startTime: '17:00', endTime: '17:30', duration: 30, capacity: 15 },
          { startTime: '17:30', endTime: '18:00', duration: 30, capacity: 15 },
          { startTime: '18:00', endTime: '18:30', duration: 30, capacity: 15 },
          { startTime: '18:30', endTime: '19:00', duration: 30, capacity: 15 }
        ],
        isActive: true,
        autoGenerate: true,
        weeksAhead: 4
      });
      
      await defaultConfig.save();
      config = defaultConfig;
      console.log("✅ Configuración por defecto creada");
    }

    const weekStart = startOfWeek(parseISO(startDate), { weekStartsOn: 1 });
    const slotsCreated = [];

    // Generar cupos para cada día permitido
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) { // Cambiado a 7 días para cubrir toda la semana
      const currentDate = addDays(weekStart, dayOffset);
      const dayOfWeek = currentDate.getDay();
      
      // Ajustar dayOfWeek para que 0 sea Domingo, 1 Lunes, etc. (date-fns)
      const adjustedDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek; 

      // Verificar si es día permitido
      if (!config.allowedWeekDays.includes(adjustedDayOfWeek)) {
        continue;
      }

      // Generar cupos para cada franja horaria
      for (const timeSlot of config.timeSlots) {
        // Verificar si ya existe un cupo para esta fecha y hora
        const existingSlot = await Slot.findOne({
          fecha: {
            $gte: startOfDay(currentDate),
            $lte: endOfDay(currentDate)
          },
          horaInicio: timeSlot.startTime,
          horaFin: timeSlot.endTime
        });

        if (!existingSlot) {
          const newSlot = new Slot({
            fecha: currentDate,
            horaInicio: timeSlot.startTime,
            horaFin: timeSlot.endTime,
            capacidadMaxima: timeSlot.capacity,
            usuariosRegistrados: [],
            estado: 'disponible',
            configId: config._id
          });

          await newSlot.save();
          slotsCreated.push(newSlot);
          console.log(`✅ Cupo creado: ${format(currentDate, 'yyyy-MM-dd')} ${timeSlot.startTime}-${timeSlot.endTime}`);
        }
      }
    }

    console.log(`🎯 Total de cupos creados: ${slotsCreated.length}`);
    return slotsCreated;
  } catch (error) {
    console.error('❌ Error generando cupos:', error);
    throw error;
  }
};

// GET /api/slots/week/:startDate - Obtener cupos de una semana
router.get('/week/:startDate', async (req, res) => {
  try {
    const { startDate } = req.params;
    console.log('📅 Solicitando cupos para la semana:', startDate);

    const weekStart = startOfWeek(parseISO(startDate), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

    console.log('🔍 Buscando cupos entre:', format(weekStart, 'yyyy-MM-dd'), 'y', format(weekEnd, 'yyyy-MM-dd'));

    // Generar cupos automáticamente si no existen
    await generateSlotsForWeek(startDate);

    // Buscar cupos existentes (después de la posible generación)
    let slots = await Slot.find({
      fecha: {
        $gte: startOfDay(weekStart),
        $lte: endOfDay(weekEnd)
      }
    }).sort({ fecha: 1, horaInicio: 1 });

    res.json({
      success: true,
      data: slots,
      message: `${slots.length} cupos encontrados para la semana`
    });

  } catch (error) {
    console.error('❌ Error obteniendo cupos de la semana:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo cupos de la semana',
      error: error.message
    });
  }
});

// POST /api/slots/generate-week - Generar cupos para una semana específica
router.post('/generate-week', async (req, res) => {
  try {
    const { startDate } = req.body;
    console.log('🔄 Solicitud de generación de cupos para:', startDate);

    const slotsCreated = await generateSlotsForWeek(startDate);

    res.json({
      success: true,
      data: slotsCreated,
      message: `${slotsCreated.length} cupos generados exitosamente`
    });

  } catch (error) {
    console.error('❌ Error generando cupos:', error);
    res.status(500).json({
      success: false,
      message: 'Error generando cupos',
      error: error.message
    });
  }
});

// GET /api/slots - Obtener todos los cupos
router.get('/', async (req, res) => {
  try {
    const slots = await Slot.find().sort({ fecha: 1, horaInicio: 1 });
    
    res.json({
      success: true,
      data: slots,
      message: `${slots.length} cupos encontrados`
    });

  } catch (error) {
    console.error('❌ Error obteniendo cupos:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo cupos',
      error: error.message
    });
  }
});

// POST /api/slots/:id/register - Registrar usuario en un cupo
router.post('/:id/register', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const slot = await Slot.findById(id);
    if (!slot) {
      return res.status(404).json({
        success: false,
        message: 'Cupo no encontrado'
      });
    }

    // Verificar si el cupo está disponible
    if (slot.usuariosRegistrados.length >= slot.capacidadMaxima) {
      return res.status(400).json({
        success: false,
        message: 'El cupo está lleno'
      });
    }

    // Verificar si el usuario ya está registrado
    if (slot.usuariosRegistrados.includes(userId)) {
      return res.status(400).json({
        success: false,
        message: 'El usuario ya está registrado en este cupo'
      });
    }

    // Registrar usuario
    slot.usuariosRegistrados.push(userId);
    
    // Actualizar estado si está lleno
    if (slot.usuariosRegistrados.length >= slot.capacidadMaxima) {
      slot.estado = 'lleno';
    }

    await slot.save();

    res.json({
      success: true,
      data: slot,
      message: 'Usuario registrado exitosamente en el cupo'
    });

  } catch (error) {
    console.error('❌ Error registrando usuario en cupo:', error);
    res.status(500).json({
      success: false,
      message: 'Error registrando usuario en cupo',
      error: error.message
    });
  }
});

// GET /api/slots/today - Obtener cupos de hoy
router.get('/today', async (req, res) => {
  try {
    const today = new Date();
    const slots = await Slot.find({
      fecha: {
        $gte: startOfDay(today),
        $lte: endOfDay(today)
      }
    }).populate('usuariosRegistrados', 'nombre apellido email').sort({ horaInicio: 1 });

    res.json({
      success: true,
      data: slots,
      message: `${slots.length} citas encontradas para hoy`
    });

  } catch (error) {
    console.error('❌ Error obteniendo citas de hoy:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo citas de hoy',
      error: error.message
    });
  }
});

module.exports = router;

