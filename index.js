require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');

const app = express();

// Conectar a la base de datos
connectDB();

// Middleware
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rutas
app.use("/api/users", require("./routes/users"));
app.use("/api/schedule-config", require("./routes/scheduleConfig"));
app.use("/api/invitation", require("./routes/invitation"));

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({
    message: 'API Backend Promotoras funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor'
  });
});

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});

