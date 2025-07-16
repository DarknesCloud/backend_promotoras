const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  slotId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Slot",
    required: true,
  },
  asistio: {
    type: Boolean,
    required: true,
  },
  fechaMarcado: {
    type: Date,
    default: Date.now,
  },
  marcadoPor: {
    type: String,
    required: false,
  },
  observaciones: {
    type: String,
    required: false,
  },
});

module.exports = mongoose.model("Attendance", attendanceSchema);


