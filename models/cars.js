const mongoose = require("mongoose");
mongoose.set("useFindAndModify", false);
const Schema = mongoose.Schema;

var carSchema = new Schema({
  url: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: false
  },
  description: {
    type: String,
    required: false
  },
  imgs: {
    type: Array,
    required: false
  },
  price: {
    type: Number,
    required: false
  },
  contactNumber: {
    type: Number,
    required: false
  },
  year: {
    type: Number,
    required: false
  },
  make: {
    type: String,
    require: false
  },
  model: {
    type: String,
    require: false
  },
  parish: {
    type: String,
    require: false
  },
  posted: {
    type: Boolean,
    require: false
  },
  bodyType: {
    type: String,
    require: false
  },
  driverSide: {
    type: String,
    require: false
  },
  transmission: {
    type: String,
    require: false
  },
  mileage: {
    type: String,
    require: false
  },
  date: {
    type: String,
    require: false
  },
  user: {
    type: String,
    require: false
  },
  comments: {
    type: String,
    require: false
  }
});

const Cars = mongoose.model("Cars", carSchema);

module.exports = Cars;
