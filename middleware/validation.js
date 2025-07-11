const validateUser = (req, res, next) => {
  const { nombre, apellido, email, telefono, edad, ciudad, experiencia, motivacion, disponibilidad } = req.body;

  // Validaciones básicas
  if (!nombre || !apellido || !email || !telefono || !edad || !ciudad || !experiencia || !motivacion || !disponibilidad) {
    return res.status(400).json({
      success: false,
      message: 'Todos los campos son obligatorios'
    });
  }

  // Validar edad
  if (edad < 18 || edad > 100) {
    return res.status(400).json({
      success: false,
      message: 'La edad debe estar entre 18 y 100 años'
    });
  }

  // Validar email
  const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Por favor ingrese un email válido'
    });
  }

  // Validar teléfono (básico)
  if (telefono.length < 10) {
    return res.status(400).json({
      success: false,
      message: 'El teléfono debe tener al menos 10 dígitos'
    });
  }

  next();
};

module.exports = { validateUser };

