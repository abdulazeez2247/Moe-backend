// utils/sendEmail.js
const nodemailer = require('nodemailer');

const sendEmail = async ({ email, subject, message }) => {
  // create transporter
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST, // e.g., smtp.gmail.com
    port: process.env.EMAIL_PORT, // usually 587
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  // email options
  const mailOptions = {
    from: `"Your App" <${process.env.EMAIL_USER}>`,
    to: email,
    subject,
    text: message
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
