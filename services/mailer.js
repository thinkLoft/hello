const nodemailer = require('nodemailer');
const db = require('../models');
const { priceCheck } = require('./priceAnalysis');

function mailerConditions(car) {
  if (car.year >= 2001 && car.price <= 600000 && car.price >= 100000) {
    db.Cars.find({ year: car.year, make: car.make, model: car.model, price: { $gte: 100000 } })
      .then((docs) => sendAlert(car, priceCheck(docs)))
      .catch((err) => console.error('Mailer query error:', err.message));
  }
}

async function sendAlert(car, data) {
  const transporter = nodemailer.createTransport({
    host: process.env.AUTH_HOST,
    port: Number(process.env.AUTH_PORT),
    secure: true,
    auth: { user: process.env.AUTH_USER, pass: process.env.AUTH_PASS },
  });

  const title = `${car.year} ${car.make} ${car.model} $${car.price} (Avg: $${Math.round(data.average)})`;

  await transporter
    .sendMail({
      from: process.env.FROM_EMAIL,
      to: process.env.TO_EMAIL,
      subject: `New listing alert from Beego: ${title}`,
      html: `
        <h4>New car matching your criteria:</h4>
        <a href="${car.url}">${car.url}</a>
        <br><br>
        <strong>${title}</strong><br>
        Parish: ${car.parish}<br>
        Contact: ${car.contactNumber}
      `,
    })
    .catch((err) => console.error('Mail send error:', err.message));
}

module.exports = { mailerConditions };
