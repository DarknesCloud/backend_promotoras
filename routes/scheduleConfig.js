const express = require("express");
const router = express.Router();
const ScheduleConfig = require("../models/ScheduleConfig");

// @route   GET api/schedule-config
// @desc    Obtener todas las configuraciones de horario
// @access  Public
router.get("/", async (req, res) => {
  try {
    const configs = await ScheduleConfig.find();
    res.json(configs);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
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
    dailyTimeSlots,
    timeZone,
    isActive,
  } = req.body;

  try {
    const newConfig = new ScheduleConfig({
      name,
      startDate,
      endDate,
      allowedWeekDays,
      dailyTimeSlots,
      timeZone,
      isActive,
    });

    const config = await newConfig.save();
    res.json(config);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route   PUT api/schedule-config/:id
// @desc    Actualizar una configuración de horario existente
// @access  Public
router.put("/:id", async (req, res) => {
  const {
    name,
    startDate,
    endDate,
    allowedWeekDays,
    dailyTimeSlots,
    timeZone,
    isActive,
  } = req.body;

  // Build config object
  const configFields = {};
  if (name) configFields.name = name;
  if (startDate) configFields.startDate = startDate;
  if (endDate) configFields.endDate = endDate;
  if (allowedWeekDays) configFields.allowedWeekDays = allowedWeekDays;
  if (dailyTimeSlots) configFields.dailyTimeSlots = dailyTimeSlots;
  if (timeZone) configFields.timeZone = timeZone;
  if (isActive !== undefined) configFields.isActive = isActive;

  try {
    let config = await ScheduleConfig.findById(req.params.id);

    if (!config) return res.status(404).json({ msg: "Config not found" });

    config = await ScheduleConfig.findByIdAndUpdate(
      req.params.id,
      { $set: configFields },
      { new: true }
    );

    res.json(config);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route   DELETE api/schedule-config/:id
// @desc    Eliminar una configuración de horario
// @access  Public
router.delete("/:id", async (req, res) => {
  try {
    const config = await ScheduleConfig.findById(req.params.id);

    if (!config) return res.status(404).json({ msg: "Config not found" });

    await ScheduleConfig.findByIdAndDelete(req.params.id);

    res.json({ msg: "Config removed" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

module.exports = router;


