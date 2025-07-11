// backend-promotoras-new/utils/mailer.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail', // o 'hotmail', 'yahoo', SMTP personalizado, etc.
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function enviarCorreo({ to, subject, html }) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject,
    html,
  };

  try {
    const result = await transporter.sendMail(mailOptions);
    console.log('📧 Correo enviado:', result.response);
    return result;
  } catch (error) {
    console.error('❌ Error enviando correo:', error);
    throw error;
  }
}

module.exports = { enviarCorreo };
