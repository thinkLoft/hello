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

// Serve built frontend — works both locally (client/dist) and on server (public/)
const frontendDist = process.env.NODE_ENV === 'production'
  ? path.join(__dirname, 'public')
  : path.join(__dirname, 'client/dist');

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(frontendDist));
}

// Health endpoint — always responds even when DB is down
app.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  res.json({ ok: dbState === 1, db: states[dbState] ?? 'unknown', version: require('./package.json').version });
});

app.use('/api', carRoutes);

if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

let dbReady = false;

async function connectDb() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/helloV1', {
      serverSelectionTimeoutMS: 10000,
    });
    console.log('MongoDB connected');
    dbReady = true;

    const { loadMakeDb } = require('./services/validator');
    await loadMakeDb();

    require('./jobs/scrapeJob');
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    // Retry after 30 s — do NOT exit; let Passenger keep the process alive
    setTimeout(connectDb, 30000);
  }
}

async function start() {
  // Start HTTP server immediately so Passenger considers the app healthy
  app.listen(PORT, () => console.log(`API Server listening on PORT ${PORT}`));
  await connectDb();
}

start();
