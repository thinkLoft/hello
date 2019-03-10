// ==========================
// ========= Config =========
// ==========================
const router = require("express").Router();
// Tools
const axios = require("axios");
const cheerio = require("cheerio");
const CronJob = require("cron").CronJob;

// CSV Tools
const fs = require("fs");
const moment = require("moment");
const json2csv = require("json2csv").parse;
const path = require("path");

// Require all models
const db = require("../models");
const fields = ["srcURL", "year", "make", "model", "trim", "price", "parish"];

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
  query
    .where("contactNumber")
    .exists()
    .ne(null || 0);
  // verify it has at least one image
  query.where("imgs").gt([]);
  // Limit to 500
  query.limit(1000);

  query.exec(function(err, docs) {
    res.send(docs);
  });
});

// Return count of all listings
router.get("/count", function(req, res) {
  db.Post.countDocuments(function(err, docs) {
    response = "";
    response += docs;
    res.send(response);
  });
});

router.get("/csv", function(req, res) {
  db.Post.find({}, function(err, docs) {
    if (err) {
      return res.status(500).json({ err });
    } else {
      let csv;
      try {
        csv = json2csv(docs, { fields });
      } catch (err) {
        return res.status(500).json({ err });
      }
      const dateTime = moment().format("YYYYMMDDhhmmss");
      const filePath = path.join(__dirname, "csv-" + dateTime + ".csv");
      fs.writeFile(filePath, csv, function(err) {
        if (err) {
          return res.json(err).status(500);
        } else {
          setTimeout(function() {
            fs.unlinkSync(filePath); // delete this file after 30 seconds
          }, 30000);
          return res.download(filePath);
        }
      });
    }
  });
});

module.exports = router;

// ==========================
// ========== APP ===========
// ==========================

// ===========
// Puppeteer
// ===========
const puppeteer = require("puppeteer");

async function puppetMaster(res) {
  if (res.length > 0) {
    const browser = await puppeteer.launch({
      // headless: false
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();

    var firstRun = true;
    var count = 0;

    for (let newItem of res) {
      count++;
      await page.goto(newItem.srcURL, { waitUntil: "networkidle2" });
      await page.evaluate(() => {
        $(".phone-author__title").click();
      });
      if (firstRun) {
        await page.evaluate(() => {
          $(".js-agree-terms-dialog").click();
        });
        firstRun = false;
      }

      await page.waitFor(800);
      var html = await page.content();
      var $ = await cheerio.load(html);
      var results = {};
      // await console.log("3: grabbed content");
      if ($(".phone-author-subtext__main")[0] === undefined) {
        results.contactNumber = 0;
        // await console.log("4: no Number");
      } else {
        results.contactNumber = $(".phone-author-subtext__main")
          .text()
          .replace(/[^0-9]+/g, "");
        await console.log(
          "Contact Number Found: #" + count + " - " + results.contactNumber
        );
      }

      // find and update imgs
      await db.Post.findOneAndUpdate({ srcURL: newItem.srcURL }, results).catch(
        err => console.log("error in the contacts db findAndUpdate function")
      ); // end of db findOneandUdpdate
      await console.log("added to db: " + newItem.postTitle);
    } // end of for loop statement

    await browser.close();
    console.log("browser closed\n=====");
  } // End if Statement
}

// A - CRAWLER: AUTO ADS CHECKER
// =====================================
function checker() {
  axios.get("https://www.autoadsja.com/rss.asp").then(function(response) {
    // Then, we load that into cheerio and save it to $ for a shorthand selector
    var $ = cheerio.load(response.data, { xmlMode: true });

    $("item").each(function(i, element) {
      var srcURL = $(this)
        .children("link")
        .text();

      // Check
      db.Post.find({ srcURL: srcURL }, function(err, docs) {
        if (docs.length) {
          // no ad found
        } else {
          // console.log("Ad Found: " + srcURL);
          scraper(srcURL);
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
    var model = ymm[2].replace(/\-.*/g, "").trim();
    var modelIndex = title.indexOf(model) + model.length + 1;
    var trim = title
      .substring(modelIndex)
      .replace(/\-.*/g, "")
      .trim();

    if (
      $(".per-detail > ul > li") !== undefined &&
      $(".per-detail > ul > li")[0] !== undefined
    ) {
      // Check array undefined to catch err from array
      var location = $(".per-detail > ul > li")[0]
        .children[0].data.replace("Location: ", "")
        .replace(/\s+/g, "")
        .replace(".", ". ");
      // console.log(location);

      var bodyType = $(".per-detail > ul > li")[1]
        .children[0].data.replace("Body Type: ", "")
        .replace(/\s+/g, "")
        .replace(".", ". ");
      // console.log(bodyType);

      var driverSide = $(".per-detail > ul > li")[2]
        .children[0].data.replace("Driver Side: ", "")
        .replace(/\s+/g, "")
        .replace(".", ". ");
      // console.log(driverSide);

      var driveType = $(".per-detail > ul > li")[3]
        .children[0].data.replace("Drive Type: ", "")
        .replace(/\s+/g, "")
        .replace(".", ". ");
      // console.log(driveType);

      var transmission = $(".per-detail > ul > li")[4]
        .children[0].data.replace("Transmission: ", "")
        .replace(/\s+/g, "")
        .replace(".", ". ");
      // console.log(transmission);

      var fuelType = $(".per-detail > ul > li")[5]
        .children[0].data.replace("Fuel type: ", "")
        .replace(/\s+/g, "")
        .replace(".", ". ");
      // console.log(fuelType);

      var engineSize = $(".per-detail > ul > li")[6]
        .children[0].data.replace("CC rating: ", "")
        .replace(/\s+/g, "")
        .replace(".", ". ");
      // console.log(engineSize);

      var mileage = $(".per-detail > ul > li")[7]
        .children[0].data.replace("Mileage: ", "")
        .replace(/\s+/g, "")
        .replace(".", ". ");
      // console.log(mileage);
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
    result.user = "autoadsja";
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
    result.bodyType = bodyType;
    result.driverSide = driverSide;
    result.driveType = driveType;
    result.transmission = transmission;
    result.fuelType = fuelType;
    result.engineSize = engineSize;
    result.mileage = mileage;
    result.trim = trim;
    result.posted = false;

    nullCheck(result);
    // create new row in database
    // db.Post.create(result).catch(err => console.log(err));

    // console.log("Auto Ad Scraped: " + result.srcURL);
  });

  return "hello from pageCrawler";
  // end of crawler
}

// C - SCRAPER: Jamiaca Cars
// =====================================
function pageScraper(element) {
  axios
    .get(element)
    .then(function(response) {
      var $ = cheerio.load(response.data);

      // page Crawler
      $(".announcement-block__title").each(function(i, element) {
        // grab sc URL
        var srcURL = "https://www.jacars.net" + $(this).attr("href");

        var result = {}; // Save an empty result object

        // Check if ad Exists in DB
        db.Post.find({ srcURL: srcURL }, function(err, docs) {
          if (docs.length) {
            // console.log("no ad found");
          } else {
            // console.log("JA Car ad Found: " + srcURL);

            axios.get(srcURL).then(function(response) {
              var $ = cheerio.load(response.data);

              var title = $("#ad-title")
                .text()
                .trim();

              var tempTitle = title.split(" ");

              var make = tempTitle[0];

              var model = tempTitle[1];

              var year = tempTitle[tempTitle.length - 1];

              var postTitle =
                year +
                " " +
                make +
                " " +
                model +
                " - " +
                $(".announcement-price__cost")
                  .text()
                  .trim();

              var price = $(".announcement-price__cost")
                .text()
                .replace(/[^0-9.-]+/g, "")
                .trim(); // Clean price

              if (price < 10000 && price > 100) {
                price = price * 1000;
              }

              var description = $(".announcement-description")
                .text()
                .trim();

              var attr = {};

              $(".chars-column > li").each(function(i, element) {
                subtitle = $(this)
                  .children("span")
                  .text();
                val = $(this)
                  .children("a")
                  .text();

                switch (subtitle) {
                  case "Year":
                    attr.year = val;
                    break;
                  case "Body type":
                    attr.bodyType = val;
                    break;
                  case "Fuel type":
                    attr.fuelType = val;
                    break;
                  case "Gearbox":
                    attr.transmission = val;
                    break;
                  case "Colour":
                    attr.colour = val;
                    break;
                  case "Right hand drive":
                    attr.driverSide = val;
                    break;
                  case "Engine size":
                    attr.engineSize = val;
                    break;
                  case "Seats":
                    attr.seats = val;
                    break;
                  case "Mileage":
                    attr.mileage = val;
                    break;
                }
              });

              var imgs = [];
              $(".announcement-content-container")
                .children("img")
                .each(function(i) {
                  imgs.push(
                    $(this)
                      .attr("src")
                      .trim()
                  );
                });

              var location = $(".announcement__location")
                .children("span")
                .text();

              var parish = parishCheck(location);
              console.log("jacars: " + parish);

              // ================
              // Update Results object
              result.user = "jacars";
              result.srcURL = srcURL;
              result.postTitle = postTitle;
              result.price = price;
              result.year = yearCheck(attr.year);
              result.make = make;
              result.model = model;
              result.parish = parish;
              // result.contactNumber = contactNumber;
              result.description = description;
              result.posted = false;
              result.bodyType = attr.bodyType;
              result.transmission = attr.transmission;
              // result.date = dateCaptured;
              result.trim = attr.engineSize;
              result.driverSide = attr.driverSide;
              result.mileage = attr.mileage;
              result.fuelType = attr.fuelType;
              result.imgs = imgs;

              nullCheck(result);
              // Add to database
              // db.Post.create(result).catch(err =>
              //   console.log(err + "\nerror in create statement")
              // ); //end of db create
            }); // end of axios statement
          } // end of else
        }); // end db check
      });
    })
    .catch(err => console.log(err));

  return "hello from pageScraper";
  // end of crawler
}

// D - RetNum: Jamaica Cars
// =====================================
function retNum() {
  // Build query to get the lastest listings sorted by date
  var query = db.Post.find({}).sort({ _id: -1 });

  // verify if has a contact number
  query.where("contactNumber").eq(null);

  // verify it has a contact number
  query.where("user").eq("jacars");

  // Limit to 500
  query.limit(3);

  query.exec(async function(err, docs) {
    puppetMaster(docs);
  });
}

// E - Scraper: Jamaican Cars Online
// =====================================

function scaperJCO(link) {
  axios.get(link).then(function(response) {
    var $ = cheerio.load(response.data);

    // Search for each item
    $(".jco-card > a").each(function(i) {
      // filter out external links
      if (
        $(this)
          .attr("href")
          .startsWith("https://jamaicaclassifiedonline.com/auto/cars")
      ) {
        var srcURL = $(this).attr("href");

        // Check if ad Exists in DB
        db.Post.find({ srcURL: srcURL }, function(err, docs) {
          if (docs.length) {
            // console.log("no ad found");
          } else {
            axios.get(srcURL).then(function(response) {
              // console.log("JCO ad found - " + srcURL);
              var $ = cheerio.load(response.data);

              // Object to hold attributes
              var attr = {};

              // Check through Information Section
              $("li.collection-item ").each(function() {
                var subtitle = $(this)
                  .children("div")
                  .text()
                  .replace(/:\W*.*/g, "")
                  .trim();
                var val = $(this)
                  .children("div")
                  .children("a")
                  .text()
                  .trim();

                switch (subtitle) {
                  case "Year":
                    attr.year = yearCheck(val);
                    break;
                  case "Make":
                    attr.make = val;
                    break;
                  case "Model":
                    attr.model = val;
                    break;
                  case "Body Type":
                    attr.bodyType = val;
                    break;
                  case "Fuel Type":
                    attr.fuelType = val;
                    break;
                  case "Transmission":
                    attr.transmission = val;
                    break;
                  case "Driver Side":
                    attr.driverSide = val;
                    break;
                }
              }); // end of Information section loop

              if (attr.year == undefined) {
                // filter empty posts
              } else {
                // console.log("JCO Ad found: " + srcURL);
                // Target Information Area
                $("div.col.s12.l3.m6.flow-text").each(function(i) {
                  // Get Number
                  if (
                    $(this)
                      .children("a")
                      .attr("href") !== undefined &&
                    $(this)
                      .children("a")
                      .attr("href")
                      .startsWith("tel:")
                  ) {
                    attr.contactNumber = $(this)
                      .children("a")
                      .attr("href")
                      .replace(/tel:/g, "")
                      .trim();
                  } // end of get contact number function

                  // Get Price
                  if (
                    $(this)
                      .last()
                      .contents()
                      .text()
                      .trim()
                      .replace(/(\W)*\$/g, "$")
                      .startsWith("$")
                  ) {
                    attr.price = $(this)
                      .last()
                      .contents()
                      .text()
                      .trim()
                      .replace(/[^0-9.-]+/g, "");
                  } // end of get price function

                  // Get dirty parish
                  if (
                    $(this)
                      .last()
                      .contents()
                      .text()
                      .replace(/(\W)*/g, "")
                      .trim()
                      .startsWith("map")
                  ) {
                    attr.parish = parishCheck(
                      $(this)
                        .last()
                        .contents()
                        .text()
                        .replace(/(\W)*map/g, "")
                        .trim()
                    );
                  }
                  // end of get parish
                }); // end of each title area function

                // Get Description
                attr.description = $("div.wysiwyg")
                  .text()
                  .trim();

                // get Features area
                $("span.card-title").each(function() {
                  if (
                    $(this)
                      .text()
                      .startsWith("FEATURES")
                  ) {
                    attr.description +=
                      "\n\n" +
                      $(this)
                        .next()
                        .text()
                        .trim();
                  }
                }); // end of features area

                // Get Images
                var imgs = [];
                $("a.item-images").each(function() {
                  imgs.push($(this).attr("href"));
                });
              } // end if year empty statement

              // Build title
              attr.postTitle = $("#title")
                .text()
                .replace(/For Sale: /g, "")
                .trim();

              // Build Results Object
              attr.user = "jamaicaonlineclassifieds";
              attr.srcURL = srcURL;
              attr.imgs = imgs;
              attr.date = moment().format("YYYYMMDDhhmmss");

              nullCheck(attr);
              // // Add to database
              // db.Post.create(attr).catch(err =>
              //   console.log(err + "\nerror in create statement")
              // ); //end of db create
            }); // end second Axios statement
          }
        }); // end db find statement
      } // end filter for ex  ternal links
    }); // end search for each item
  }); // end axio function
} // function end

// ==========================
// ==== QUALITY CONTROL =====
// ==========================

function nullCheck(x) {
  var res = x;
  res.posted = true;
  res.date = moment().format("YYYYMMDDhhmmss");

  if (res.price === undefined || res.price === null) {
    console.log(res.user + ": no price");
    res.posted = false;
  }

  if (res.make === undefined || res.make === null) {
    console.log(res.user + ": no make");

    res.posted = false;
  }

  if (res.model === undefined || res.model === null) {
    console.log(res.user + ": no model");

    res.posted = false;
  }

  if (res.year === undefined || res.year === null) {
    console.log(res.user + ": no year");

    res.posted = false;
  }

  if (res.parish === undefined || res.parish === null) {
    console.log(res.user + ": no parish");

    res.posted = false;
  }

  console.log(res.user + " Verdict: " + res.posted + " (" + res.srcURL + ")");
}

// Year Checker for digit and between range
function yearCheck(year) {
  if (isNaN(year)) {
    // console.log("false: Not a number");
    return null;
  } else if (year <= 1935 || year >= 2100) {
    // console.log("false: not between 1935-2100");
    return null;
  } else return year;
}

function parishCheck(location) {
  var parish = undefined;

  if (location == undefined) {
    //do nothing
  } else if (location.startsWith("Saint Andrew")) {
    parish = "Kingston/St. Andrew";
  } else if (location.startsWith("Saint ")) {
    parish = location.replace(/Saint /g, "St. ");
  } else if (location.startsWith("St")) {
    parish = location.replace(/St /g, "St. ");
  } else if (location.startsWith("Kingston")) {
    parish = "Kingston/St. Andrew";
  } else {
    parish = location;
  }

  return parish;
}
// ==========================
// ====== AUTOMATION ========
// ==========================

const job = new CronJob(
  "0 */15 * * * *",
  function() {
    checker(); // Start Auto Ads
    pageScraper("https://www.jacars.net/vehicles/"); // Start jaCArs Ads
    retNum(); // ContactCleaner
    scaperJCO("https://jamaicaclassifiedonline.com/auto/cars/4");
    console.log("Cron Run, Next Run:");
    console.log(this.nextDates());
  },
  null,
  true,
  null,
  null,
  true
);
