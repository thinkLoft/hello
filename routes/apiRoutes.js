// ==========================
// ========= Config =========
// ==========================
const router = require("express").Router();
// Tools
const axios = require("axios");
const cheerio = require("cheerio");
const CronJob = require("cron").CronJob;
const puppeteer = require("puppeteer");
const { distance, closest } = require("fastest-levenshtein");
const currentYear = new Date().getFullYear();
const nodemailer = require("nodemailer");
var stats = require("stats-lite");
require("dotenv").config({ path: "./../.env" });

// CSV Tools
const fs = require("fs");
const moment = require("moment");
const json2csv = require("json2csv").parse;
const path = require("path");

// Require all models
const db = require("../models");
const { Console } = require("console");
const { STATUS_CODES } = require("http");
const fields = [
  "url",
  "posted",
  "user",
  "year",
  "make",
  "model",
  "price",
  "date",
  "parish",
  "bodyType",
  "transmission",
  "driverSide",
  "contactNumber",
  "comments",
];
var carDB = [];
const bodyTypes = [
  "SEDAN",
  "COUPE",
  "VAN",
  "CONVERTIBLE",
  "PICKUP",
  "TRUCK",
  "BUS",
  "SUV",
  "HATCHBACK",
  "WAGON",
  "MINIVAN",
  "MOTORCYCLE",
  "WRECKER",
];

// ==========================
// ======== Routes ==========
// ==========================

router.get("/carsforsale", function (req, res) {
  // Build query to get the lastest listings sorted by date
  var query = db.Cars.find({}).sort({ _id: -1 });
  var oldLimt = currentYear - 10;

  query.where("posted").equals(true);

  query.where("price").gte(1000000);

  query.where("year").gte(oldLimt);
  // verify it has at least one image
  query.where("imgs").gt([]);
  // Limit to 200

  query.limit(500);

  query.exec(function (err, docs) {
    res.send(docs);
  });
});

router.get("/undermil", function (req, res) {
  // Build query to get the lastest listings sorted by date
  var query = db.Cars.find({}).sort({ _id: -1 });
  var oldLimt = currentYear - 10;

  query.where("posted").equals(true);

  query.where("price").lt(1000000);

  query.where("year").gte(oldLimt);
  // verify it has at least one image
  query.where("imgs").gt([]);
  // Limit to 200

  query.limit(200);

  query.exec(function (err, docs) {
    res.send(docs);
  });
});

router.get("/latest", function (req, res) {
  // Build query to get the lastest listings sorted by date
  var query = db.Cars.find({}).sort({ _id: -1 });
  var oldLimt = currentYear - 10;

  query.where("posted").equals(true);

  query.where("year").lt(oldLimt);
  // verify it has at least one image
  query.where("imgs").gt([]);
  // Limit to 500

  query.limit(500);

  query.exec(function (err, docs) {
    res.send(docs);
  });
});

router.get("/2019", function (req, res) {
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

  query.where("posted").equals(true);

  query.limit(1000);

  query.exec(function (err, docs) {
    res.send(docs);
  });
});

// Return count of all listings
router.get("/2019count", function (req, res) {
  db.Post.countDocuments(function (err, docs) {
    response = "";
    response += docs;
    res.send(response);
  });
});

// Return count of all listings
router.get("/count", function (req, res) {
  db.Cars.countDocuments(function (err, docs) {
    response = "";
    response += docs;
    res.send(response);
  });
});

router.get("/csv", function (req, res) {
  db.Cars.find({}, function (err, docs) {
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
      fs.writeFile(filePath, csv, function (err) {
        if (err) {
          return res.json(err).status(500);
        } else {
          setTimeout(function () {
            fs.unlinkSync(filePath); // delete this file after 30 seconds
          }, 30000);
          return res.download(filePath);
        }
      });
    }
  }).limit(15000);
});

// Calculator
router.get("/data/:yearUpper/:yearLower/:make/:model/", function (req, res) {
  // Build query to get the lastest listings sorted by date
  var query = db.Cars.find({}).sort({ _id: -1 });

  query.where("year").lte(req.params.yearUpper);

  query.where("year").gte(req.params.yearLower);

  query
    .where("make")
    .equals(req.params.make.charAt(0).toUpperCase() + req.params.make.slice(1));

  query
    .where("model")
    .equals(
      req.params.model.charAt(0).toUpperCase() + req.params.model.slice(1)
    );

  // query.where("posted").equals(true);

  query.where("price").gte("100000");
  query.where("price").lte("10000000");

  // query.limit(20);

  query.exec(function (err, docs) {
    var data = priceCheck(docs);
    console.log(data);
    res.send(data);
  });
});

module.exports = router;

// ==========================
// ========== APP ===========
// ==========================

// CAR QUERY VALIDATOR
axios
  .get("https://vpic.nhtsa.dot.gov/api/vehicles/getallmakes?format=json")
  .then(function (results) {
    data = results.data.Results;
    data.forEach(function (val, i) {
      carDB.push(val.Make_Name);
    });
  })
  .catch(function (error) {
    console.log("Error " + error.message);
  });

// ===========
// Puppeteer
// ===========

async function puppetMaster(res) {
  if (res.length > 0) {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    var count = 0;

    for (let newItem of res) {
      count++;
      await page.goto(newItem.url, { waitUntil: "networkidle2" });
      await page.evaluate(() => {
        $(".phone-author__title").click();
      });

      await page.waitFor(800);
      var html = await page.content();
      var $ = await cheerio.load(html);
      var results = {};
      if ($(".phone-author-subtext__main")[0] === undefined) {
        results.contactNumber = 0;
      } else {
        results.contactNumber = $(".phone-author-subtext__main")
          .text()
          .replace(/[^0-9]+/g, "");

        results.contactNumber = contactCheck(results.contactNumber);
      }

      results.contactNumber;

      // find and update imgs
      await db.Cars.findOneAndUpdate(
        { url: newItem.url },
        results
      ).catch((err) =>
        console.log("error in the contacts db findAndUpdate function." + err)
      ); // end of db findOneandUdpdate
    } // end of for loop statement

    await browser.close();
  } // End if Statement
}

function mailerConditions(res) {
  // console.log(res);
  if (
    res.year >= 2001 &&
    // res.year <= 2005 &&
    // res.model.includes("Honda") &&
    res.price <= 600000 &&
    res.price >= 100000
  ) {
    // Build query to get the lastest listings sorted by date
    var query = db.Cars.find({}).sort({ _id: -1 });

    query.where("year").equals(res.year);

    query.where("make").equals(res.make);

    query.where("model").equals(res.model);

    // query.where("posted").equals(true);

    query.where("price").gte("100000");
    // query.where("price").lte("10000000");

    // query.limit(20);

    query.exec(function (err, docs) {
      var data = priceCheck(docs);
      // console.log(data);
      mailer(res, data);
    });
  }
}

async function mailer(res, data) {
  // Generate test SMTP service account from ethereal.email

  // create reusable transporter object using the default SMTP transport
  let transporter = nodemailer.createTransport({
    host: process.env.AUTH_HOST,
    port: process.env.AUTH_PORT,
    secure: true, // true for 465, false for other ports
    auth: {
      user: process.env.AUTH_USER, // generated ethereal user
      pass: process.env.AUTH_PASS, // generated ethereal password
    },
  });

  let title =
    res.year +
    " " +
    res.make +
    " " +
    res.model +
    " $" +
    res.price +
    "(Avg: $" +
    data.average +
    ")";
  let message =
    '<h4> Here is a car that matches your filter: </h4>\n\n<a href="' +
    res.url +
    '">' +
    res.url +
    "</a><br><br>Car: " +
    title +
    "<br>Parish: " +
    res.parish +
    "<br> Contact Number: " +
    res.contactNumber;

  // send mail with defined transport object
  await transporter.sendMail(
    {
      from: process.env.FROM_EMAIL, // sender address
      to: process.env.TO_EMAIL, // list of receivers
      subject: "New car listing alert from Beego: " + title, // Subject line
      text: "This is a test", // plain text body
      html: message, // html body
    },
    (err, info) => {
      if (info != undefined) {
        // console.log(info.envelope);
        // console.log(info.messageId);
      } else if (err) {
        console.log(err);
      }
    }
  );
}
// A - CRAWLER: AUTO ADS CHECKER
// =====================================
function checker() {
  axios
    .get(process.env.SITE1)
    .then(function (response) {
      // Then, we load that into cheerio and save it to $ for a shorthand selector
      var $ = cheerio.load(response.data, { xmlMode: true });

      $("item").each(function (i, element) {
        var srcURL = $(this).children("link").text();

        // Check
        db.Cars.find({ url: srcURL }, function (err, docs) {
          if (docs.length) {
            // no ad found
          } else {
            scraper(srcURL);
          }
        })
          .limit(1000)
          .catch((err) => console.log(`Failed to find documents: ${err}`));
        // end post function
      });
      // end each function
    })
    .catch(function (error) {
      console.log("Error " + error.message);
    });
  // end of axios function
  return "hello from checker function";
}

// B - SCRAPER: AUTOADS
// =====================================
function scraper(link) {
  axios
    .get(link)
    .then(function (response) {
      // Then, we load that into cheerio and save it to $ for a shorthand selector
      var $ = cheerio.load(response.data);

      // Save an empty result object
      var result = {};

      // crawled variables
      var title = $(".price-tag > h1").text();
      var price = $(".price-tag > h2")
        .text()
        .replace(/[^0-9.-]+/g, "");
      var ymm = title.split(" "); // break Title into array of text
      var year = ymm[0];
      var make = ymm[1].replace(/\-.*/g, "").trim();
      var model = ymm[2].replace(/\-.*/g, "").trim();
      if (
        $(".per-detail > ul > li") !== undefined &&
        $(".per-detail > ul > li")[0] !== undefined
      ) {
        // Check array undefined to catch err from array
        var location = $(".per-detail > ul > li")[0]
          .children[0].data.replace("Location: ", "")
          .replace(/\s+/g, "")
          .replace(".", ". ");

        var bodyType = $(".per-detail > ul > li")[1]
          .children[0].data.replace("Body Type: ", "")
          .replace(/\s+/g, "")
          .replace(".", ". ");

        var driverSide = $(".per-detail > ul > li")[2]
          .children[0].data.replace("Driver Side: ", "")
          .replace(/\s+/g, "")
          .replace(".", ". ");

        var transmission = $(".per-detail > ul > li")[4]
          .children[0].data.replace("Transmission: ", "")
          .replace(/\s+/g, "")
          .replace(".", ". ");

        var mileage = $(".per-detail > ul > li")[7]
          .children[0].data.replace("Mileage: ", "")
          .replace(/\s+/g, "")
          .replace(".", ". ");
      }

      var contact = $(".contact_details > a")
        .attr("href")
        .replace(/[^0-9]+/g, "");

      // Get Features for description
      var features = [];

      features.push($(".vehicle-description").text());

      $(".per-detail > ul > li").each(function (i) {
        features.push($(this).text());
      });

      features.push($(".contact_details").text());

      var description = "";
      features.forEach(function (element) {
        description += element.toString();
        description += "\n";
      });

      // Get Images
      var imgs = [];
      $(".gallery__thumbs > a").each(function (i) {
        imgs.push($(this).attr("href"));
      });

      // Update Results object
      result.user = "autoadsja";
      result.url = response.config.url;
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
      result.transmission = transmission;
      result.mileage = mileage;
      result.posted = false;

      nullCheck(result);
    })
    .catch(function (error) {
      console.log("Error from autoads axios" + error.message);
    }); // end of axios statement

  return "hello from pageCrawler";
  // end of crawler
}

// C - SCRAPER: Ja Cars
// =====================================
function pageScraper(element) {
  axios
    .get(element.toString())
    .then(function (response) {
      var $ = cheerio.load(response.data);

      // page Crawler
      $(".announcement-block__title").each(function (i, element) {
        // grab sc URL
        var srcURL = "https://www.jacars.net" + $(this).attr("href");

        var result = {}; // Save an empty result object

        // Check if ad Exists in DB
        db.Cars.find({ url: srcURL }, function (err, docs) {
          if (docs.length) {
            // console.log("no ad found");
          } else {
            // console.log("JA Car ad Found: " + srcURL);

            axios.get(srcURL).then(function (response) {
              var $ = cheerio.load(response.data);

              var title = $("#ad-title").text().trim();

              var tempTitle = title.split(" ");

              var make = tempTitle[0];

              var model = tempTitle[1];

              var priceTemp = $("meta[itemprop='price']")
                .attr("content")
                .replace(/[^0-9.-]+/g, "");

              var price = Math.round(priceTemp);

              // var postTitle = year + " " + make + " " + model + " - " + price;

              if (price < 10000 && price > 100) {
                price = price * 1000;
              }

              var description = $(".announcement-description").text().trim();

              var attr = {};

              $(".chars-column > li").each(function (i, element) {
                subtitle = $(this).children("span").text();
                val = $(this).children("a").text();

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
                .each(function (i) {
                  imgs.push($(this).attr("src").trim());
                });

              var location = $(".announcement__location")
                .children("span")
                .text();

              // ================
              // Update Results object
              result.user = "jacars";
              result.url = srcURL;
              result.price = price;
              result.year = attr.year;
              result.make = make;
              result.model = model;
              result.parish = location;
              result.description = description;
              result.bodyType = attr.bodyType;
              result.transmission = attr.transmission;
              result.driverSide = attr.driverSide;
              result.mileage = attr.mileage;
              result.imgs = imgs;

              nullCheck(result);
            }); // end of axios statement
          } // end of else
        }).limit(1000); // end db check
      }); // end of crawler
    })
    .catch((err) => console.log("JAcars Axio Error" + err));

  return "hello from pageScraper";
  // end of crawler
}

// D - RetNum: Jamaica Cars
// =====================================
function retNum() {
  // Build query to get the lastest listings sorted by date
  var query = db.Cars.find({}).sort({ _id: -1 });

  // verify if has a contact number
  query.where("contactNumber").eq(null);

  // verify it has a contact number
  query.where("user").eq("jacars");

  // only pull ones that pass nullcheck
  query.where("posted").eq(true);

  // Limit to 500
  query.limit(3);

  query.exec(async function (err, docs) {
    puppetMaster(docs);
  });
}

// E - Scraper: Jamaican Cars Online
// =====================================

function scaperJCO(link) {
  axios.get(link).then(function (response) {
    var $ = cheerio.load(response.data);

    // Search for each item
    $(".jco-card > a").each(function (i) {
      // filter out external links
      if (
        $(this)
          .attr("href")
          .startsWith("https://jamaicaclassifiedonline.com/auto/cars")
      ) {
        var srcURL = $(this).attr("href");

        // Check if ad Exists in DB
        db.Cars.find({ url: srcURL }, function (err, docs) {
          if (docs.length) {
            // console.log("no ad found");
          } else {
            axios.get(srcURL).then(function (response) {
              var $ = cheerio.load(response.data);

              // Object to hold attributes
              var attr = {};

              // Check through Information Section
              $("li.collection-item ").each(function () {
                var subtitle = $(this)
                  .children("div")
                  .text()
                  .replace(/:\W*.*/g, "")
                  .trim();
                var val = $(this).children("div").children("a").text().trim();

                switch (subtitle) {
                  case "Year":
                    attr.year = val;
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
                // Target Information Area
                $("div.col.s12.l3.m6.flow-text").each(function (i) {
                  // Get Number
                  if (
                    $(this).children("a").attr("href") !== undefined &&
                    $(this).children("a").attr("href").startsWith("tel:")
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
                    attr.parish = $(this)
                      .last()
                      .contents()
                      .text()
                      .replace(/(\W)*map/g, "")
                      .trim();
                  }
                  // end of get parish
                }); // end of each title area function

                // Get Description
                attr.description = $("div.wysiwyg").text().trim();

                // get Features area
                $("span.card-title").each(function () {
                  if ($(this).text().startsWith("FEATURES")) {
                    attr.description += "\n\n" + $(this).next().text().trim();
                  }
                }); // end of features area

                // Get Images
                var imgs = [];
                $("a.item-images").each(function () {
                  imgs.push($(this).attr("href"));
                });
              } // end if year empty statement

              // Build Results Object
              attr.user = "jamaicaonlineclassifieds";
              attr.url = srcURL;
              attr.imgs = imgs;

              nullCheck(attr);
            }); // end second Axios statement
          }
        })
          .limit(1000)
          .catch((err) => console.log(`Failed to find documents: ${err}`)); // end db find statement
      } // end filter for ex  ternal links
    }); // end search for each item
  }); // end axio function
} // function end

// F - Scraper: KMS
// =====================================

function scraperKMS(link) {
  //crawler
  axios
    .get(link)
    .then(function (response) {
      var $ = cheerio.load(response.data);

      $("div.blog-title > h2 > a").each(function (i, element) {
        var srcURL = $(this).attr("href");

        if (srcURL.search("listing") != -1) {
          // Check if ad Exists in DB
          db.Cars.find({ url: srcURL }, function (err, docs) {
            if (docs.length) {
              // console.log("EXISTS");
            } else {
              // console.log("nope it new");

              var result = {};
              axios.get(srcURL).then(function (response) {
                var $ = cheerio.load(response.data);

                var workingTitle = $('h2[itemprop="name"]')
                  .text()
                  .trim()
                  .split(" ");

                var year = workingTitle[0];

                var make = workingTitle[1];

                var model = workingTitle.slice(2).join(" ");

                var price = $('span[itemprop="price"]')
                  .text()
                  .replace(/[^0-9.-]+/g, "")
                  .trim(); // Clean price

                var description = $("#vehicle").text();

                var bodyType = $(".listing_category_body-style")
                  .children()
                  .eq(1)
                  .text()
                  .trim();

                var transmission = $(".listing_category_transmission")
                  .children()
                  .eq(1)
                  .text()
                  .trim();

                var parish = $(".listing_category_location")
                  .children()
                  .eq(1)
                  .text()
                  .trim();

                var driverSide = $(".listing_category_drive")
                  .children()
                  .eq(1)
                  .text()
                  .trim();

                var mileage = $(".listing_category_mileage")
                  .children()
                  .eq(1)
                  .text()
                  .trim();

                var imgs = [];

                $("ul.slides > li > img").each(function (i) {
                  imgs.push($(this).attr("src").trim());
                });

                // =======
                // Build Results object
                result.user = "kms";
                result.url = srcURL;
                result.price = price;
                result.year = year;
                result.make = make;
                result.model = model;
                result.parish = parish;
                result.description = description;
                result.bodyType = bodyType;
                result.transmission = transmission;
                result.driverSide = driverSide;
                result.mileage = mileage;
                result.imgs = imgs;
                result.contactNumber = "18764331652";
                nullCheck(result);
              }); // end of single ad scraper
            } // end of else statement for DB check
          });
        } else {
          // console.log("it is not a listing");
        } // end of else statement for listing check
      });
    })
    .catch((err) => console.log("KMS Error" + err)); // end of crawler
} // end of scraper KMS function

// ==========================
// ==== QUALITY CONTROL =====
// ==========================

function nullCheck(x) {
  //config for audit
  var res = x;
  res.comments = "";
  res.posted = true;
  res.date = moment().format("YYYYMMDD");

  // Null Check
  if (x === null || res === undefined) {
    res.comments += "object null";
    res.post = false;
  }

  // Image Check
  if (res.imgs === undefined || res.imgs === null || res.imgs.length === 0) {
    res.comments += "No images. ";
    res.posted = false;
  }

  // Price Check
  if (res.price === undefined || res.price === null) {
    res.comments += "No price. ";
    res.price = 0;
  } else if (parseInt(res.price) < 100000 || res.price > 30000000) {
    // res.posted = false;
    res.comments += "Price out of range: $" + res.price + ". ";
    res.price = 0;
  }

  // Make Check
  if (res.make === undefined || res.make === null) {
    res.comments += "No make. ";
    res.posted = false;
  } else if (
    carDB.includes(makeCheck(res.make).toUpperCase()) &&
    res.make != "Alfa Romeo"
  ) {
    res.make = makeCheck(res.make);
  } else {
    res.posted = false;
    res.comments += "Bad Make: " + res.make + " vs " + closest(res.make, carDB);
  }

  // Model Check
  if (res.model === undefined || res.model === null) {
    res.comments += "No model. ";
    res.posted = false;
  }

  // Year Check
  if (res.year === undefined || res.year === null) {
    res.comments += "No year. ";
    res.posted = false;
  } else if (isNaN(res.year)) {
    res.comments += "Year is not a number. ";
    res.posted = false;
  } else if (res.year <= 1935 || res.year >= currentYear + 1) {
    res.comments += "Year not between 1935-2100. ";
    res.posted = false;
  }

  // Parish Check
  if (res.parish === undefined || res.parish === null) {
    res.comments += "No parish. ";
    res.posted = false;
  } else if (res.parish.startsWith("Saint Andrew")) {
    res.parish = "Kingston/St. Andrew";
  } else if (res.parish.startsWith("Saint ")) {
    res.parish = res.parish.replace(/Saint /g, "St. ");
  } else if (res.parish.startsWith("St")) {
    res.parish = res.parish.replace(/St /g, "St. ");
  } else if (res.parish.startsWith("Kingston")) {
    res.parish = "Kingston/St. Andrew";
  } else if (res.parish.startsWith("OutsideJamaica")) {
    res.parish = "Kingston/St. Andrew";
  } else if (
    res.parish == "Trelawny" ||
    res.parish == "Westmoreland" ||
    res.parish == "Hanover" ||
    res.parish == "Clarendon" ||
    res.parish == "Portland" ||
    res.parish == "Manchester"
  ) {
    //do nothing
  } else {
    res.comments += res.parish + ": Bad Parish. ";
    res.posted = false;
  }

  // Driver Side Check
  if (res.driverSide === undefined || res.driverSide === null) {
    res.comments += "No driverSide. Default to RHD. ";
    res.driverSide = "Right Hand Drive";
  } else if (
    res.driverSide.toLowerCase().includes("left") ||
    res.driverSide.includes("LHD")
  ) {
    res.driverSide = "Left Hand Drive";
  } else if (
    res.driverSide.toLowerCase().includes("right") ||
    res.driverSide.includes("RHD")
  ) {
    res.driverSide = "Right Hand Drive";
  } else {
    res.comments += res.driverSide + ": bad DriverSide. ";
  }

  // Transmission Check
  if (res.transmission === undefined || res.transmission === null) {
    res.comments += "No Transmission. Default to Automatic. ";
    res.transmission = "Automatic";
  } else if (res.transmission.toLowerCase().includes("manual")) {
    res.transmission = "Manual";
  } else if (
    res.transmission == "Tiptronic" ||
    res.transmission.toLowerCase().includes("automatic") ||
    res.transmission == "CVT"
  ) {
    res.transmission = "Automatic";
  } else {
    res.comments = res.transmission + ": bad transmission. ";
    res.posted = false;
  }

  // Contact Number Check
  if (res.contactNumber !== undefined && res.contactNumber.startsWith("1876")) {
    // nothing
  } else if (res.user == "jacars") {
    // still do nothing
  } else {
    res.comments += "bad contact: " + res.contactNumber + ". ";
    // res.posted = false;
  }

  // Body Type Check
  if (res.bodyType === undefined || res.bodyType === null) {
    res.comments += "No Body Type. ";
    res.posted = false;
  } else if (bodyTypes.includes(res.bodyType.toUpperCase())) {
    // good
  } else if (
    res.bodyType == "Station Wagon" ||
    res.bodyType == "StationWagon"
  ) {
    res.comments += res.bodyType + " <- BodyType needed work. ";
    res.bodyType = "Wagon";
  } else if (res.bodyType == "Hatch Back") {
    res.bodyType = "Hatchback";
  } else if (res.bodyType == "Motor Bike" || res.bodyType == "Bike") {
    res.comments += res.bodyType + " <- BodyType needed work. ";
    res.bodyType = "Motorcycle";
  } else if (
    res.bodyType == "Sports Utility Vehicle" ||
    res.bodyType == "Sports Activity Vehicle" ||
    res.bodyType == "Compact Utility Vehicle"
  ) {
    res.comments += res.bodyType + " <- BodyType needed work. ";
    res.bodyType = "SUV";
  } else if (
    res.bodyType == "4 Door Coupe" ||
    res.bodyType == "Estate" ||
    res.bodyType == "Grand Coupe"
  ) {
    res.comments += res.bodyType + " <- BodyType needed work. ";
    res.bodyType = "Sedan";
  } else if (res.bodyType == "Van" || res.bodyType == "Vans") {
    res.comments += res.bodyType + " <- BodyType needed work. ";
    res.bodyType = "Minivan";
  } else {
    res.comments +=
      "Doesn't Match: " +
      res.bodyType +
      " Vs " +
      closest(res.bodyType, bodyTypes) +
      "(" +
      distance(res.bodyType, closest(res.bodyType, bodyTypes)) +
      "). Default to VS";
    res.bodyType = closest(res.bodyType, bodyTypes);
  }

  updatedb(res); // update Database Call
  if (res.posted == true) {
    mailerConditions(res);
  }
} // end nullCheck

function updatedb(result) {
  // Add to database
  db.Cars.create(result).catch((err) =>
    console.log(err + "\nerror in create statement")
  ); //end of db create
}

function makeCheck(make) {
  if (make.startsWith("Merc") || make.startsWith("Benz")) {
    return "Mercedes-Benz";
  } else if (make.startsWith("Land")) {
    return "Land Rover";
  } else if (make.startsWith("Mini")) {
    return "Mini";
  } else return make;
}

function contactCheck(contactNumber) {
  if (parseInt(contactNumber, 10) < 10000000) {
    var areaCode = 1876;
    areaCode += contactNumber;
    return areaCode;
  } else return contactNumber;
}

function priceCheck(docs) {
  var data = {};
  var pricingArray = [];
  data.count = docs.length;
  data.total = 0;
  docs.forEach(function (element, counter) {
    data.total += element.price;
    pricingArray.push(element.price);
  });
  data.average = stats.mean(pricingArray);
  data.std = stats.stdev(pricingArray);
  data.high = data.average + data.std * 2;
  data.above = data.average + data.std;
  data.below = data.average - data.std;
  data.great = data.average - data.std * 2;
  data.crazy = data.average - data.std * 3;
  return data;
}

// ==========================
// ====== AUTOMATION ========
// ==========================

const job = new CronJob(
  "0 */15 * * * *",
  function () {
    checker(); // Start Auto Ads
    pageScraper(process.env.SITE2); // Start jaCArs Ads
    retNum(); // ContactCleaner
    scaperJCO(process.env.SITE3);
    scraperKMS(process.env.SITE4);
    console.log("Cron Run, Next Run:");
    console.log(this.nextDates());
  },
  null,
  true,
  null,
  null,
  true
);
