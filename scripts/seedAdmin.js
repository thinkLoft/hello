require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user');

async function seedAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/helloV1');
    console.log('Connected to MongoDB');

    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('Admin user already exists:', existingAdmin.email);
      process.exit(0);
    }

    const email = process.env.ADMIN_EMAIL || 'admin@example.com';
    const password = process.env.ADMIN_PASSWORD || 'changeme';

    const passwordHash = await User.hashPassword(password);
    const admin = new User({ email, passwordHash, role: 'admin' });
    await admin.save();

    console.log(`Admin user created: ${email}`);
    console.log('Change your password immediately in production!');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err.message);
    process.exit(1);
  }
}

seedAdmin();
