const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function run() {
  const res = await axios.get('https://vpic.nhtsa.dot.gov/api/vehicles/getallmakes?format=json', { timeout: 15000 });
  const makes = res.data.Results.map(v => v.Make_Name);
  const outPath = path.join(__dirname, '../data/car-makes.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(makes, null, 2));
  console.log(`Saved ${makes.length} makes to data/car-makes.json`);
}

run().catch(err => { console.error(err.message); process.exit(1); });
