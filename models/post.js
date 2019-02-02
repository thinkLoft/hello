const mongoose = require("mongoose");
mongoose.set("useFindAndModify", false);
const Schema = mongoose.Schema;

var postSchema = new Schema({
  srcURL: {
    type: String,
    required: true
  },
  postTitle: {
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
  scraped: {
    type: Boolean,
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
  driveType: {
    type: String,
    require: false
  },
  transmission: {
    type: String,
    require: false
  },
  fuelType: {
    type: String,
    require: false
  },
  engineSize: {
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
  }
});

const Post = mongoose.model("Post", postSchema);

module.exports = Post;
