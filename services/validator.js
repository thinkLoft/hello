const axios = require('axios');
const { closest } = require('fastest-levenshtein');
const db = require('../models');
const { priceCheck } = require('./priceAnalysis');

const currentYear = new Date().getFullYear();
let carDB = [];

const BODY_TYPES = [
  'SEDAN', 'COUPE', 'VAN', 'CONVERTIBLE', 'PICKUP',
  'TRUCK', 'BUS', 'SUV', 'HATCHBACK', 'WAGON',
  'MINIVAN', 'MOTORCYCLE', 'WRECKER',
];

const BODY_TYPE_ALIASES = {
  'Station Wagon': 'Wagon',
  StationWagon: 'Wagon',
  'Hatch Back': 'Hatchback',
  'Motor Bike': 'Motorcycle',
  Bike: 'Motorcycle',
  'Sports Utility Vehicle': 'SUV',
  'Sports Activity Vehicle': 'SUV',
  'Compact Utility Vehicle': 'SUV',
  '4 Door Coupe': 'Sedan',
  Estate: 'Sedan',
  'Grand Coupe': 'Sedan',
  Van: 'Minivan',
  Vans: 'Minivan',
};

const VALID_PARISHES = [
  'Trelawny', 'Westmoreland', 'Hanover',
  'Clarendon', 'Portland', 'Manchester',
];

async function loadMakeDb() {
  try {
    const response = await axios.get(
      'https://vpic.nhtsa.dot.gov/api/vehicles/getallmakes?format=json'
    );
    carDB = response.data.Results.map((v) => v.Make_Name);
    console.log(`Loaded ${carDB.length} car makes from NHTSA`);
  } catch (err) {
    console.error('Failed to load make DB:', err.message);
  }
}

function makeCheck(make) {
  if (make.startsWith('Merc') || make.startsWith('Benz')) return 'Mercedes-Benz';
  if (make.startsWith('Land')) return 'Land Rover';
  if (make.startsWith('Mini')) return 'Mini';
  return make;
}

function contactCheck(contactNumber) {
  const num = String(contactNumber);
  return parseInt(num, 10) < 10000000 ? `1876${num}` : num;
}

// Returns { saved: boolean, posted: boolean, codes: string[] }
async function nullCheck(x) {
  const res = {
    ...x,
    comments: '',
    posted: true,
    date: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
  };
  const codes = [];

  // Mileage: normalize empty string/undefined to null
  res.mileage = (res.mileage && String(res.mileage).trim()) || null;

  // Image check — strict gate
  if (!res.imgs?.length) {
    res.comments += 'No images. ';
    res.posted = false;
    codes.push('noImages');
  }

  // Price check
  if (!res.price) {
    res.comments += 'No price. ';
    res.price = 0;
    codes.push('noPrice');
  } else if (parseInt(res.price) < 100000 || res.price > 30000000) {
    res.comments += `Price out of range: $${res.price}. `;
    res.price = 0;
    codes.push('priceOutOfRange');
  }

  // Make check — strict gate
  if (!res.make) {
    res.comments += 'No make. ';
    res.posted = false;
    codes.push('noMake');
  } else {
    const normalized = makeCheck(res.make);
    if (carDB.includes(normalized.toUpperCase()) && normalized !== 'Alfa Romeo') {
      res.make = normalized;
    } else {
      res.posted = false;
      const suggestion = carDB.length ? closest(res.make, carDB) : 'Unknown';
      res.comments += `Bad Make: ${res.make} (closest: ${suggestion}). `;
      codes.push('badMake');
    }
  }

  // Model check — strict gate
  if (!res.model) {
    res.comments += 'No model. ';
    res.posted = false;
    codes.push('noModel');
  }

  // Year check — strict gate
  if (!res.year) {
    res.comments += 'No year. ';
    res.posted = false;
    codes.push('noYear');
  } else if (isNaN(res.year)) {
    res.comments += 'Year is not a number. ';
    res.posted = false;
    codes.push('badYear');
  } else if (Number(res.year) <= 1935 || Number(res.year) >= currentYear + 1) {
    res.comments += `Year out of range: ${res.year}. `;
    res.posted = false;
    codes.push('yearOutOfRange');
  }

  // Parish check — soft gate: default instead of reject
  if (!res.parish) {
    res.comments += 'No parish. Default to Kingston/St. Andrew. ';
    res.parish = 'Kingston/St. Andrew';
    codes.push('noParishDefaulted');
  } else if (res.parish.startsWith('Saint Andrew') || res.parish.startsWith('Kingston')) {
    res.parish = 'Kingston/St. Andrew';
  } else if (res.parish.startsWith('OutsideJamaica')) {
    res.parish = 'Kingston/St. Andrew';
  } else if (res.parish.startsWith('Saint ')) {
    res.parish = res.parish.replace(/Saint /g, 'St. ');
  } else if (res.parish.startsWith('St ')) {
    res.parish = res.parish.replace(/St /g, 'St. ');
  } else if (!VALID_PARISHES.includes(res.parish) && !res.parish.startsWith('St.')) {
    res.comments += `${res.parish}: Bad parish. Default to Kingston/St. Andrew. `;
    res.parish = 'Kingston/St. Andrew';
    codes.push('badParishDefaulted');
  }

  // Driver side check
  if (!res.driverSide) {
    res.comments += 'No driverSide. Default to RHD. ';
    res.driverSide = 'Right Hand Drive';
  } else if (res.driverSide.toLowerCase().includes('left') || res.driverSide.includes('LHD')) {
    res.driverSide = 'Left Hand Drive';
  } else if (res.driverSide.toLowerCase().includes('right') || res.driverSide.includes('RHD')) {
    res.driverSide = 'Right Hand Drive';
  }

  // Transmission check — soft gate: default instead of reject
  if (!res.transmission) {
    res.comments += 'No transmission. Default to Automatic. ';
    res.transmission = 'Automatic';
    codes.push('noTransmissionDefaulted');
  } else if (res.transmission.toLowerCase().includes('manual')) {
    res.transmission = 'Manual';
  } else if (
    ['Tiptronic', 'CVT'].includes(res.transmission) ||
    res.transmission.toLowerCase().includes('automatic')
  ) {
    res.transmission = 'Automatic';
  } else {
    res.comments += `${res.transmission}: bad transmission. Default to Automatic. `;
    res.transmission = 'Automatic';
    codes.push('badTransmissionDefaulted');
  }

  // Contact number check
  if (res.user !== 'jacars' && res.contactNumber && !String(res.contactNumber).startsWith('1876')) {
    res.comments += `bad contact: ${res.contactNumber}. `;
  }

  // Body type check — soft gate: default Sedan instead of reject
  if (!res.bodyType) {
    res.comments += 'No body type. Default to Sedan. ';
    res.bodyType = 'Sedan';
    codes.push('noBodyTypeDefaulted');
  } else if (BODY_TYPES.includes(res.bodyType.toUpperCase())) {
    res.bodyType = res.bodyType.charAt(0).toUpperCase() + res.bodyType.slice(1).toLowerCase();
  } else if (BODY_TYPE_ALIASES[res.bodyType]) {
    res.comments += `${res.bodyType} <- body type normalized. `;
    res.bodyType = BODY_TYPE_ALIASES[res.bodyType];
    codes.push('bodyTypeAliased');
  } else {
    const normalized = BODY_TYPES.map((b) => b.charAt(0) + b.slice(1).toLowerCase());
    res.bodyType = closest(res.bodyType, normalized);
    res.comments += `Body type fuzzy-matched to ${res.bodyType}. `;
    codes.push('bodyTypeFuzzy');
  }

  const saved = await saveToDb(res);

  if (res.posted) {
    const { mailerConditions } = require('./mailer');
    mailerConditions(res);
  }

  return { saved, posted: res.posted, codes };
}

async function saveToDb(result) {
  try {
    await db.Cars.findOneAndUpdate(
      { url: result.url },
      { $set: { ...result, lastSeenAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return true;
  } catch (err) {
    console.error('DB upsert error:', err.message);
    return false;
  }
}

module.exports = { nullCheck, makeCheck, contactCheck, loadMakeDb };
