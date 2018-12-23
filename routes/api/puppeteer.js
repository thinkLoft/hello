// Puppeteer Broswer
const puppeteer = require("puppeteer");

// File Handlers
var fs = require("fs");
var request = require("request");

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
