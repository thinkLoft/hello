require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');

const carRoutes = require('./routes/cars');
const authRoutes = require('./routes/auth');
const statsRoutes = require('./routes/api/stats');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(morgan('dev'));
app.use(cors({ credentials: true, origin: process.env.NODE_ENV === 'production' ? false : true }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const SessionStore = require('express-session').MemoryStore;
const sessionStore = new SessionStore();

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-prod',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    },
  })
);

// Serve built frontend — works both locally (client/dist) and on server (public/)
const frontendDist = process.env.NODE_ENV === 'production'
  ? path.join(__dirname, 'public')
  : path.join(__dirname, 'client/dist');

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(frontendDist));
}

// Health endpoint — always responds even when DB is down
app.get('/health', async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  const env = {
    MONGODB_URI: !!process.env.MONGODB_URI,
    SITE1: !!process.env.SITE1,
    SITE4: !!process.env.SITE4,
    SESSION_SECRET: !!process.env.SESSION_SECRET,
    NODE_ENV: process.env.NODE_ENV ?? 'development',
  };
  let lastRuns = null;
  if (dbState === 1) {
    try {
      lastRuns = await mongoose.connection.db
        .collection('scraperstats')
        .find({})
        .sort({ lastRun: -1 })
        .toArray();
    } catch (_) {}
  }
  res.json({
    ok: dbState === 1,
    db: states[dbState] ?? 'unknown',
    version: require('./package.json').version,
    env,
    lastRuns,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api', statsRoutes);
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

    // Migrate: drop capped ScraperRun collection so it's recreated as a regular TTL collection
    try {
      const collNames = (await mongoose.connection.db.listCollections({ name: 'scraperruns' }).toArray()).map(c => c.name);
      if (collNames.includes('scraperruns')) {
        const info = await mongoose.connection.db.command({ collStats: 'scraperruns' });
        if (info.capped) {
          await mongoose.connection.db.dropCollection('scraperruns');
          console.log('Migrated scraperruns: dropped capped collection (will recreate as TTL)');
        }
      }
    } catch (e) {
      console.error('ScraperRun migration error:', e.message);
    }

    const scraperJob = require('./jobs/scrapeJob');
    // If no scraper has run in the last hour, fire immediately on startup
    const recentRun = await mongoose.connection.db
      .collection('scraperstats')
      .findOne({ lastRun: { $gt: new Date(Date.now() - 60 * 60 * 1000) } });
    if (!recentRun) {
      console.log('No recent scraper run detected — triggering immediate startup run');
      scraperJob.fireOnTick();
    }
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
