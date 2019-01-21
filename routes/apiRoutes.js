// ==========================
// ========= Config =========
// ==========================
const router = require("express").Router();
// Tools
const axios = require("axios");
const cheerio = require("cheerio");
const CronJob = require("cron").CronJob;

// Require all models
const db = require("../models");

// ==========================
// ======== Routes ==========
// ==========================
// // Route for getting all Articles from the db
router.get("/crawler", async function(req, res) {
  var ret = checker();
  res.send(ret);
});

router.get("/cron", function(req, res) {
  job.start();
  res.send("Cron Started");
});

router.get("/latest", function(req, res) {
  // Build query to get the lastest listings sorted by date
  var query = db.Post.find({}).sort({ _id: -1 });

  // verify it has a contact number
  query.where("contactNumber").ne(null);
  // verify it has at least one image
  query.where("imgs").gt([]);
  // Limit to 500
  query.limit(500);

  query.exec(function(err, docs) {
    res.send(docs);
  });
});

// Return count of all listings
db.Post.count(function(err, docs) {
  console.log(docs);
});

module.exports = router;

// ==========================
// ========== APP ===========
// ==========================

// A - CRAWLER: AUTO ADS CHECKER
// =====================================
function checker() {
  axios.get("https://www.autoadsja.com/rss.asp").then(function(response) {
    // Then, we load that into cheerio and save it to $ for a shorthand selector
    var $ = cheerio.load(response.data, { xmlMode: true });

    $("item").each(function(i, element) {
      var result = {};

      // Add the text and href of every link, and save them as properties of the result object
      result.srcURL = $(this)
        .children("link")
        .text();
      result.srcTitle = $(this)
        .children("title")
        .text();
      result.srcImg = $(this)
        .children("description")
        .text();

      // Check
      db.Post.find({ srcURL: result.srcURL }, function(err, docs) {
        if (docs.length) {
          // no ad found
        } else {
          console.log("Ad Found: " + result.srcURL);
          scraper(result.srcURL);
        }
      });
      // end post function
    });
    // end each function
  });
  // end of axios function
  return "hello from checker function";
}

// B - SCRAPER: AUTOADS
// =====================================
function scraper(link) {
  axios.get(link).then(function(response) {
    // Then, we load that into cheerio and save it to $ for a shorthand selector
    var $ = cheerio.load(response.data);

    // Save an empty result object
    var result = {};

    // crawled variables
    var title = $(".price-tag > h1").text();
    var price = $(".price-tag > h2")
      .text()
      .replace(/[^0-9.-]+/g, "");
    // Add Formatted price to Title
    title += " - $" + price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    var ymm = title.split(" "); // break Title into array of text
    var year = ymm[0];
    var make = ymm[1].replace(/\-.*/g, "").trim();
    var modelIndex = title.indexOf(make) + make.length + 1;
    var model = title
      .substring(modelIndex)
      .replace(/\-.*/g, "")
      .trim();

    if ($(".per-detail > ul > li") === undefined) {
      // Check array undefined to catch err from array
      var location = $(".per-detail > ul > li")[0]
        .children[0].data.replace("Location: ", "")
        .replace(/\s+/g, "")
        .replace(".", ". ");
    }

    var contact = $(".contact_details")
      .text()
      .replace(/[^0-9]+/g, "")
      .substring(0, 11);

    // Get Features for description
    var features = [];

    features.push($(".vehicle-description").text());

    $(".per-detail > ul > li").each(function(i) {
      features.push($(this).text());
    });

    features.push($(".contact_details").text());

    var description = "";
    features.forEach(function(element) {
      description += element.toString();
      description += "\n";
    });

    // Get Images
    var imgs = [];
    $(".product-images > .prod-box > a").each(function(i) {
      imgs.push($(this).attr("href"));
    });

    // Update Results object
    result.srcURL = response.config.url;
    result.postTitle = title;
    result.price = price;
    result.year = year;
    result.make = make;
    result.model = model;
    result.parish = location;
    result.contactNumber = contact;
    result.description = description;
    result.imgs = imgs;
    result.price = price;
    result.posted = false;

    // create new row in database
    db.Post.create(result).catch(err => console.log(err));

    console.log("Auto Ad Scraped: " + result.srcURL);
  });
  return "hello from pageCrawler";
  // end of crawler
}

// C - Crawler - Jamaica Cars
// =====================================
function pageCrawler() {
  var count = 0;
  var baseURL = "https://www.jacars.net/?page=browse&e=AddedThisWeek&p=";

  var targetURL = baseURL + count;

  // Only scrapes first 10 pages
  while (count < 5) {
    // =======================change to 10
    count++;
    targetURL = baseURL + count;
    pageScraper(targetURL);
  } //end while function
}

// D - SCRAPER: Jamiaca Cars
// =====================================
function pageScraper(element) {
  axios
    .get(element)
    .then(function(response) {
      var $ = cheerio.load(response.data);

      // page Crawler
      $(".hiddenInfo").each(function(i, element) {
        // grab sc URL
        var srcURL = $(this)
          .children("a")
          .attr("href");

        var result = {}; // Save an empty result object

        var year = $(this) //  Data Cleanup
          .children("div")
          .children(".results-year")
          .text()
          .trim();

        var tempTitle = $(this) //  Data Cleanup
          .children("div")
          .children("a")
          .children("div")
          .text()
          .split(" ");

        var make = tempTitle[0].trim();

        tempTitle.shift(); // Removes first entry (make) from array of words from title

        var model = tempTitle.join(" ").trim(); // Join the remaining array entries to create the model

        var dirtyPrice = $(this)
          .children("div")
          .children(".results-priceE")
          .text()
          .trim(); // Grab dirty price

        var price = dirtyPrice.replace(/[^0-9.-]+/g, "").trim(); // Clean price

        var postTitle = year + " " + make + " " + model + " - " + dirtyPrice; // Building the year

        var descArr = [];

        $(this)
          .children("div")
          .children(".results-lable")
          .each(function() {
            descArr.push(
              $(this)
                .text()
                .trim()
            );
          });
        // Removed empty array elements
        descArr.shift();
        descArr.shift();

        description = descArr.join("\n"); // Joined the remaining together

        contactNumberArray = description.match(/Tel:(\W+(\d+))-(\d+)/g); //Contact Number parsers

        if (contactNumberArray !== null) {
          contactNumber = contactNumberArray[0].replace(/[^0-9]+/g, ""); // Verify if Array empty, then parse numbers
        }

        //Location parser
        parishArr = [
          "Clarendon",
          "Manchester",
          "Westmoreland",
          "Kingston",
          "Saint Catherine",
          "Portland",
          "Hanover",
          "Saint Andrew",
          "Saint Ann",
          "Saint Thomas",
          "Saint Elizabeth",
          "Saint James",
          "Saint Mary",
          "Trelawny"
        ];

        var parish = "";

        parishArr.forEach(function(element, i) {
          if (description.match(element) !== null) {
            parish = description.match(element)[0];
            switch (parish) {
              case "Kingston":
                parish = "Kingston/St. Andrew";
                break;
              case "Saint Andrew":
                parish = "Kingston/St. Andrew";
                break;
              case "Saint Ann":
                parish = "St. Ann";
                break;
              case "Saint Catherine":
                parish = "St. Catherine";
                break;
              case "Saint Elizabeth":
                parish = "St. Elizabeth";
                break;
              case "Saint James":
                parish = "St. James";
                break;
              case "Saint Mary":
                parish = "St. Mary";
                break;
              case "Saint Thomas":
                parish = "St. Thomas";
                break;
            }
          }
        });

        // ================
        // Update Results object
        result.srcURL = srcURL;
        result.postTitle = postTitle;
        result.price = price;
        result.year = year;
        result.make = make;
        result.model = model;
        result.parish = parish;
        result.contactNumber = contactNumber;
        result.description = description;
        result.posted = false;

        // Check if ad Exists in DB
        db.Post.find({ srcURL: result.srcURL }, function(err, docs) {
          if (docs.length) {
            // console.log("no ad found");
          } else {
            console.log("JA Car ad Found: " + result.srcURL);
            // Add Initial Result (/wo IMGS) to db
            db.Post.create(result).catch(err =>
              console.log("error in the db in create")
            ); //end of db create
            // Go out and grab Image Scraper
            axios
              .get(result.srcURL)
              .then(function(response) {
                var $ = cheerio.load(response.data);
                var imgs = [];
                var res = {};

                $("#theImages")
                  .children("div")
                  .each(function(i, element) {
                    var img = $(this)
                      .children("a")
                      .attr("href")
                      .replace(/(.JPG).*/g, ".JPG")
                      .trim();
                    imgs.push(img);
                  });

                res.imgs = imgs;

                // find and update imgs
                db.Post.findOneAndUpdate(
                  { srcURL: response.config.url },
                  res
                ).catch(err =>
                  console.log("error in the db fnidonandupdate function")
                ); // end of db findOneandUdpdate
              })
              .catch(err =>
                console.log(
                  "error in the inner Axios Function, line 332: " +
                    response.config.url +
                    " - ad: " +
                    result.srcURL
                )
              ); //end of Axios
          } // end of else statement
        }); // end db check
      });
    })
    .catch(err => console.log("err from page scraper axios function"));
  return "hello from pageScraper";
  // end of crawler
}

// ==========================
// ====== AUTOMATION ========
// ==========================

const job = new CronJob(
  "0 */15 * * * *",
  function() {
    checker();
    // pageCrawler();
    pageScraper("https://www.jacars.net/?page=browse&e=AddedThisWeek&p=1");
    pageScraper("https://www.jacars.net/");
    pageScraper("https://www.jacars.net/?page=browse&e=AddedThisWeek&p=2");
    console.log("Cron Run, Next Run:");
    console.log(this.nextDates());
  },
  null,
  true,
  null,
  null,
  true
);
