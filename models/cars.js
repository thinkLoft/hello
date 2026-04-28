const mongoose = require('mongoose');
const { Schema } = mongoose;

const carSchema = new Schema(
  {
    url: { type: String, required: true, unique: true },
    title: { type: String },
    description: { type: String },
    imgs: { type: [String], default: [] },
    price: { type: Number },
    contactNumber: { type: String },
    year: { type: Number },
    make: { type: String },
    model: { type: String },
    parish: { type: String },
    posted: { type: Boolean, default: false },
    sold: { type: Boolean, default: false },
    bodyType: { type: String },
    driverSide: { type: String },
    transmission: { type: String },
    mileage: { type: String },
    date: { type: String },
    user: { type: String },
    comments: { type: String },
  },
  { timestamps: true }
);

carSchema.index({ posted: 1, price: 1, year: 1 });
carSchema.index({ make: 1, model: 1, year: 1 });

const Cars = mongoose.model('Cars', carSchema);

module.exports = Cars;
