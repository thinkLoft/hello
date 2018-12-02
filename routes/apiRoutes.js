const axios = require("axios");
const cheerio = require("cheerio");
const router = require("express").Router();

// // Route for getting all Articles from the db
router.get("/crawl", function(req, res) {
  axios.get("https://www.autoadsja.com/rss.asp").then(function(response) {
    // Then, we load that into cheerio and save it to $ for a shorthand selector
    var $ = cheerio.load(response.data, { xmlMode: true });
    var ans = [];
    $("item").each(function(i, element) {
      var result = {};

      // Add the text and href of every link, and save them as properties of the result object
      result.link = $(this)
        .children("link")
        .text();
      result.title = $(this)
        .children("title")
        .text();
      result.img = $(this)
        .children("description")
        .text();
      ans.push(result);
    });
    res.send(ans);
  });
});

module.exports = router;

// ==========================
// ======= Functions ========
// ==========================
