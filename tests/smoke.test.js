const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

let mongod;
let app;
let db;

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.SESSION_SECRET = 'test-secret';
  process.env.NODE_ENV = 'test';
  await mongoose.connect(process.env.MONGODB_URI);
  app = require('../server');
  db = require('../models');

  await db.Cars.create({
    user: 'autoadsja',
    url: 'https://example.com/1',
    title: 'Test Listing',
    year: new Date().getFullYear() - 2,
    make: 'Toyota',
    model: 'Corolla',
    price: 2500000,
    imgs: ['https://res.cloudinary.com/test/image1.jpg'],
    posted: true,
    contactNumber: '8761234567',
  });
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
  // Force exit — cron timers and other open handles in app modules keep the loop alive
  setImmediate(() => process.exit(0));
});

test('GET /api/carsforsale returns array of public listings', async () => {
  const res = await request(app).get('/api/carsforsale');
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body));
  assert.ok(res.body.length >= 1);
  // contactNumber must be stripped, hasContact must be present
  assert.strictEqual(res.body[0].contactNumber, undefined);
  assert.strictEqual(res.body[0].hasContact, true);
});

test('GET /api/undermil, /latest, /count return 200', async () => {
  const undermil = await request(app).get('/api/undermil');
  assert.strictEqual(undermil.status, 200);
  assert.ok(Array.isArray(undermil.body));

  const latest = await request(app).get('/api/latest');
  assert.strictEqual(latest.status, 200);

  const count = await request(app).get('/api/count');
  assert.strictEqual(count.status, 200);
  assert.ok(typeof count.body.count === 'number' || typeof count.body === 'number');
});

test('PATCH /api/cars/:id without admin is rejected (401/403)', async () => {
  const car = await db.Cars.findOne({});
  const res = await request(app).patch(`/api/cars/${car._id}`).send({ sold: true });
  assert.ok([401, 403].includes(res.status), `expected 401/403, got ${res.status}`);
});

test('POST /api/cars/:id/reveal-contact returns contact number then rate-limits', async () => {
  const car = await db.Cars.findOne({});
  // First reveal succeeds
  const first = await request(app).post(`/api/cars/${car._id}/reveal-contact`);
  assert.strictEqual(first.status, 200);
  assert.strictEqual(first.body.contactNumber, '8761234567');

  // 11th reveal hits the 10/window limit
  for (let i = 0; i < 9; i++) {
    await request(app).post(`/api/cars/${car._id}/reveal-contact`);
  }
  const limited = await request(app).post(`/api/cars/${car._id}/reveal-contact`);
  assert.strictEqual(limited.status, 429);
});

test('validator nullCheck rejects no-price listing', async () => {
  const { nullCheck } = require('../services/validator');
  const result = await nullCheck({
    user: 'autoadsja',
    url: 'https://example.com/no-price',
    year: 2023,
    make: 'Toyota',
    model: 'Corolla',
    price: 0,
    imgs: ['https://x/y.jpg'],
  });
  assert.strictEqual(result.posted, false, 'no-price listing must be rejected');
  assert.ok(Array.isArray(result.codes));
  assert.ok(result.codes.includes('noPrice') || result.codes.includes('priceOutOfRange'));
});
