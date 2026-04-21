require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');

const carRoutes = require('./routes/cars');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(morgan('dev'));
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/dist')));
}

app.use('/api', carRoutes);

if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/dist/index.html'));
  });
}

async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/helloV1');
    console.log('MongoDB connected');

    const { loadMakeDb } = require('./services/validator');
    await loadMakeDb();

    require('./jobs/scrapeJob');

    app.listen(PORT, () => console.log(`API Server listening on PORT ${PORT}`));
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
