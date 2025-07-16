const express = require("express");
const router = express.Router();
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const Slot = require("../models/Slot");

// @route   POST api/attendance
// @desc    Marcar asistencia de un usuario
// @access  Public
router.post("/", async (req, res) => {
  try {
    const { userId, asistio, observaciones, marcadoPor } = req.body;

    if (!userId || asistio === undefined) {
      return res.status(400).json({
        success: false,
        message: "userId y asistio son requeridos",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado",
      });
    }

    // Check if attendance record already exists for this user and slot
    let attendance = await Attendance.findOne({ userId: userId, slotId: user.slot });

    if (attendance) {
      // Update existing attendance record
      attendance.asistio = asistio;
      attendance.observaciones = observaciones || "";
      attendance.marcadoPor = marcadoPor || "";
      attendance.fechaMarcado = new Date();
    } else {
      // Create new attendance record
      attendance = new Attendance({
        userId,
        slotId: user.slot,
        asistio,
        observaciones: observaciones || "",
        marcadoPor: marcadoPor || "",
      });
    }

    await attendance.save();

    res.json({
      success: true,
      message: "Asistencia marcada exitosamente",
      data: attendance,
    });
  } catch (error) {
    console.error("Error marcando asistencia:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
    });
  }
});

// @route   GET api/attendance/user/:userId
// @desc    Obtener historial de asistencias de un usuario
// @access  Public
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const asistencias = await Attendance.find({ userId: userId })
      .populate("slotId", "fecha horaInicio horaFin enlaceMeet estado")
      .sort({ "slotId.fecha": -1 });

    res.json({
      success: true,
      data: asistencias,
    });
  } catch (error) {
    console.error("Error obteniendo asistencias del usuario:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
    });
  }
});

module.exports = router;


