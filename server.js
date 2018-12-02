const express = require("express");
const routes = require("./routes");
const mongoose = require("mongoose");
const CronJob = require("cron").CronJob;
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const request = require("request");
const app = express();
const PORT = process.env.PORT || 3001;

// Define middleware here
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// Serve up static assets (usually on heroku)
if (process.env.NODE_ENV === "production") {
  app.use(express.static("client/build"));
}

// Add routes, both API and view
app.use(routes);

// Use morgan logger for logging requests
app.use(logger("dev"));

// Connect to the Mongo DB
mongoose.connect(
  process.env.MONGODB_URI || "mongodb://localhost/helloV1",
  { useNewUrlParser: true }
);

// Start the API server
app.listen(PORT, function() {
  console.log(`🌎  ==> API Server now listening on PORT ${PORT}!`);
});
