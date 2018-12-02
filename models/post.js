const mongoose = require("mongoose");
const Schema = mongoose.Schema;

var postSchema = new Schema({
  postTitle: {
    type: String,
    required: true
  },

  description: {
    type: String,
    required: true
  },

  imgs: {
    type: Array,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  contactNumber: {
    type: Number,
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  make: {
    type: String,
    require: true
  },
  model: {
    type: String,
    require: true
  },
  parish: {
    type: String,
    require: true
  },
  posted: {
    type: Boolean,
    require: false
  }
});

const Post = mongoose.model("Post", postSchema);

module.exports = Post;
