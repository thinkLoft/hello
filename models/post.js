const mongoose = require("mongoose");
mongoose.set("useFindAndModify", false);
const Schema = mongoose.Schema;

var postSchema = new Schema({
  srcURL: {
    type: String,
    required: true
  },
  srcTitle: {
    type: String,
    required: false
  },
  srcImg: {
    type: String,
    required: false
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
  postURL: {
    type: String,
    required: false
  }
});

const Post = mongoose.model("Post", postSchema);

module.exports = Post;
