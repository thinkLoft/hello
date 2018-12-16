// ==========================
// ========= Config =========
// ==========================
const router = require("express").Router();
// Tools
const axios = require("axios");
const cheerio = require("cheerio");

// File Handlers
var fs = require("fs");
var request = require("request");

// Require all models
const db = require("../models");

// Puppeteer Broswer
const puppeteer = require("puppeteer");

// ==========================
// ======== Routes ==========
// ==========================
// // Route for getting all Articles from the db
router.get("/crawl", async function(req, res) {
  var ret = await checker();
  await res.send(ret);
});

router.get("/scrape", function(req, res) {
  var ret = verify();
  res.send(ret);
});

router.get("/post", function(req, res) {
  var ret = ifPosted();
  res.send(ret);
});

module.exports = router;

// ==========================
// ========== APP ===========
// ==========================

// A - AUTOADS RSS CHECKER
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
          console.log("Ad Found!");
          db.Post.create(result).catch(function(err) {
            console.log(err);
          });
        }
      });
      // end post function
    });
    // end each function
  });
  // end of axios function
  return "hello from getAutoAdsLinks function";
}

// A1 - AUTOADS RSS VERIFIER
function verify() {
  db.Post.find({ postTitle: undefined })
    .then(function(post) {
      post.forEach(function(i, element) {
        console.log("ad scraped");
        console.log(i.srcURL);
        scraper(i.srcURL);
      });

      return "Verification complete";
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.send(err);
    });
}

// A2 - AUTOADS POST VERIFIER
function ifPosted() {
  db.Post.find({ posted: false }).then(async function(res) {
    count = 0;
    for (let i of res) {
      count++;
      console.log("---:" + count);
      console.time("asyncPoster");
      await asyncPoster(i);
      console.timeEnd("asyncPoster");
    }
    console.log(res.length);
  });
}

// B - AUTOADS SCRAPER
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

    var location = $(".per-detail > ul > li")[0]
      .children[0].data.replace("Location: ", "")
      .replace(/\s+/g, "")
      .replace(".", ". ");

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
    var srclink = response.config.url;

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

    db.Post.findOneAndUpdate({ srcURL: srclink }, result).catch(err =>
      console.log(err)
    );
  });
  return "hello from the crawler";
  // end of crawler
}

// C - AUTOADS POSTER
async function asyncPoster(res) {
  // check if response has missing values and skips
  if (
    res.contactNumber === null ||
    res.year === null ||
    res.make === null ||
    res.model === null ||
    res.price === null ||
    res.parish === null ||
    res.postTitle === null
  ) {
    console.log(res.postTitle + " - missing values");
  } else {
    // lOGIN
    var user = {
      username: "automater",
      password: "llipDR3x8S2DUHAnyo"
    };

    // Launch Browser
    const browser = await puppeteer.launch({
      headless: true,
      timeout: 60000,
      networkIdleTimout: 60000
    });

    // Load Initial Page
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000);
    await page.goto("https://doubleupja.com/create-listing/");

    // Login Page
    await page.evaluate(user => {
      $("#login_username").val(user.username);
      $("#login_password").val(user.password);
      $("#login").click();
    }, user);
    await page.waitForNavigation();

    // Category Page
    await page.focus("#ad_cat_id");
    await page.keyboard.press("ArrowDown", { delay: 50 });
    await page.evaluate(() => {
      $("form#mainform").submit();
    });
    await page.waitForNavigation();

    // Ad Listing Page
    // - Select Browser Uploader
    await page.click(".upload-flash-bypass > a");

    // - Fill out Form
    await page.type("#cp_make", res.make.substring(0, 4));
    await page.evaluate(res => {
      $("#cp_contact_number").val(res.contactNumber);
      $("#cp_price").val(res.price);
      $("#cp_year").val(res.year);
      $("#cp_model").val(res.model.replace(/\-.*/g, "").trim());

      $("#cp_region").val(res.parish);
      $("#post_title").val(res.postTitle);
      $("#post_content").val(res.description);
    }, res);

    // IMAGE PROCESSOR
    async function processImgs(i) {
      for (let e of i.imgs) {
        var uploadbtn = "#upload_" + count + " > input";
        var filename = "images/";
        filename += e.replace("https://www.autoadsja.com/vehicleimages/", "");
        await download(e, filename, async function() {});

        const fileInput = await page.$(uploadbtn);
        await fileInput.uploadFile(filename);

        count++;
      }
    }

    // Process Images
    // await processImgs(i);  // Turn off process imageds TEMP======================

    // // Submit button after allow image processing
    await setTimeout(async function() {
      await page.evaluate(() => {
        $("form#mainform").submit();
      });
    }, 500);
    await page.waitForNavigation();

    // Confirmation Page
    await setTimeout(async function() {
      await page.evaluate(() => {
        $("form#mainform").submit();
      });
    }, 500);
    await page.waitForNavigation();

    // Close Browser
    await setTimeout(async function() {
      await browser.close();
    }, 500);

    // Update File in DB
    await db.Post.findOneAndUpdate(
      { srcURL: res.srcURL },
      { $set: { posted: true } }
    ).catch(err => console.log(err));

    await console.log(res.postTitle);
    // End of Else Statement
  }
  // End of aysncPoster
}

// C1 - IMAGE DOWNLOADER
function download(uri, filename, callback) {
  request.head(uri, function(err, res, body) {
    request(uri)
      .pipe(fs.createWriteStream(filename))
      .on("close", callback);
  });
}

// D - CLASSIPRESS AUTO ADS POSTER
async function classiPoster() {
  // lOGIN
  var user = {
    username: "autoadsja",
    password: "llipDR3x8S2DUHAnyo"
  };

  // Launch Browser
  const browser = await puppeteer.launch({
    headless: false,
    timeout: 60000,
    networkIdleTimout: 60000
  });

  // Load Initial Page
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000);
  await page.goto("https://inhouse.thinkloft.ca/create-listing/");

  // Login Page
  await page.evaluate(user => {
    document.getElementById("login_username").value = user.username;
    document.getElementById("login_password").value = user.password;
    document.getElementById("login").click();
  }, user);
  await page.waitForNavigation();

  // Category Page
  await page.focus("#ad_cat_id");
  await page.keyboard.press("ArrowDown", { delay: 50 });
  await page.evaluate(() => {
    document.getElementById("getcat").click();
  });
  await page.waitForNavigation();

  // Ad Listing Page
  // - Select Browser Uploader
  await page.click(".upload-flash-bypass > a");

  // - Fill out Form
  await page.type("#cp_make", "Acur");
  await page.evaluate(() => {
    document.getElementById("cp_phone").value = "1555555555";
    document.getElementById("cp_price").value = "1234";
    document.getElementById("cp_year").value = "1990";
    document.getElementById("cp_model").value = "Acura";
    document.getElementById("cp_region").value = "Portland";
    document.getElementById("post_title").value = "This is the best post ever";
    document.getElementById("post_content").value =
      "This is the best post ever";
  });

  var i = {};
  i.imgs = [
    "https://www.autoadsja.com/vehicleimages/TV64U69R.jpg",
    "https://www.autoadsja.com/vehicleimages/919EU69R.jpg",
    "https://www.autoadsja.com/vehicleimages/TD39U69R.jpg",
    "https://www.autoadsja.com/vehicleimages/U4L9U69R.jpg",
    "https://www.autoadsja.com/vehicleimages/S8DTU69R.jpg"
  ];

  // IMAGE PROCESSOR
  // var count = 0;
  // const input = await page.$(".fileupload");

  // for (let e of i.imgs) {
  //   var filename = "images/";
  //   filename += e.replace("https://www.autoadsja.com/vehicleimages/", "");
  //   download(e, filename, async function() {});
  //   console.log(input);
  //   input.attachfile(filename);

  //   count++;
  // }

  // await page.evaluate(i => {
  //   const fileInputs = document.getElementsByClassName("fileupload");
  //   console.log(fileInputs);
  //   var count = 0;

  //   for (let e of i.imgs) {
  //     var filename = "images/";
  //     filename += e.replace("https://www.autoadsja.com/vehicleimages/", "");
  //     // fileInputs[count].uploadFile(filename);

  //     count++;
  //   }
  // }, i);

  // // Submit button after allow image processing
  await setTimeout(async function() {
    await page.evaluate(() => {
      document.getElementById("mainform").submit();
    });
  }, 500);
  await page.waitForNavigation();

  // Confirmation Page
  await setTimeout(async function() {
    await page.evaluate(() => {
      document.getElementById("mainform").submit();
    });
  }, 500);
  await page.waitForNavigation();

  // Close Browser
  await setTimeout(async function() {
    await browser.close();
  }, 500);

  // Update File in DB
  // await db.Post.findOneAndUpdate(
  //   { srcURL: res.srcURL },
  //   { $set: { posted: true } }
  // ).catch(err => console.log(err));

  await console.log("This done");
  // End of Else Statement
}
// End of aysncPoster

// ================================================================TEMP LAUNCHER
ifPosted();
// classiPoster();
