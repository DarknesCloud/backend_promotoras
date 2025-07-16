const express = require("express");
const router = express.Router();
const User = require("../models/User");

// @route   POST api/approvedusers
// @desc    Aprobar un usuario
// @access  Public
router.post("/", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId es requerido",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado",
      });
    }

    user.estadoAprobacion = "aprobado";
    user.fechaAprobacion = new Date();
    await user.save();

    res.json({
      success: true,
      message: "Usuario aprobado exitosamente",
      data: user,
    });
  } catch (error) {
    console.error("Error aprobando usuario:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
    });
  }
});

// @route   GET api/approvedusers
// @desc    Obtener todos los usuarios aprobados
// @access  Public
router.get("/", async (req, res) => {
  try {
    const approvedUsers = await User.find({ estadoAprobacion: "aprobado" });

    res.json({
      success: true,
      data: approvedUsers,
      count: approvedUsers.length,
    });
  } catch (error) {
    console.error("Error obteniendo usuarios aprobados:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
    });
  }
});

module.exports = router;


