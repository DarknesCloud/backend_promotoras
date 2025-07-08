const mongoose = require("mongoose");

const scheduleConfigSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  allowedWeekDays: {
    type: [Number], // 0 for Sunday, 1 for Monday, etc.
    required: true,
  },
  dailyTimeSlots: {
    type: [String], // e.g., ["09:00", "10:00", "11:00"]
    required: true,
  },
  timeZone: {
    type: String,
    required: true,
    default: "America/Mexico_City", // Default to Mexico City timezone
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model("ScheduleConfig", scheduleConfigSchema);


