const mongoose = require('mongoose');
const { Schema } = mongoose;

const postSchema = new Schema(
  {
    srcURL: { type: String, required: true },
    postTitle: { type: String },
    description: { type: String },
    imgs: { type: [String], default: [] },
    price: { type: Number },
    contactNumber: { type: String },
    year: { type: Number },
    make: { type: String },
    model: { type: String },
    trim: { type: String },
    parish: { type: String },
    scraped: { type: Boolean },
    posted: { type: Boolean },
    bodyType: { type: String },
    driverSide: { type: String },
    driveType: { type: String },
    transmission: { type: String },
    fuelType: { type: String },
    engineSize: { type: String },
    mileage: { type: String },
    date: { type: String },
    user: { type: String },
  },
  { timestamps: true }
);

const Post = mongoose.model('Post', postSchema);

module.exports = Post;
