const crypto = require('crypto');
const { v2: cloudinary } = require('cloudinary');

const ENABLED = !!process.env.CLOUDINARY_URL;

if (ENABLED) {
  // cloudinary auto-reads CLOUDINARY_URL env var (format: cloudinary://key:secret@cloud_name)
  cloudinary.config({ secure: true });
  console.log('[imageCache] Cloudinary configured — images will be cached');
} else {
  console.warn('[imageCache] CLOUDINARY_URL not set — images served from source (no caching)');
}

// Deterministic public_id from URL so re-scraping never re-uploads the same image
function urlToPublicId(url) {
  return 'beego/' + crypto.createHash('sha1').update(url).digest('hex').slice(0, 20);
}

// Upload one image URL to Cloudinary; returns the Cloudinary secure URL.
// Falls back to the original URL on any error.
async function cacheOne(originalUrl) {
  if (!ENABLED || !originalUrl) return originalUrl;
  // Skip if already a Cloudinary URL (e.g. from a previous scrape run)
  if (originalUrl.includes('cloudinary.com')) return originalUrl;
  try {
    const result = await cloudinary.uploader.upload(originalUrl, {
      public_id: urlToPublicId(originalUrl),
      overwrite: false,
      resource_type: 'image',
      timeout: 20000,
    });
    return result.secure_url;
  } catch (err) {
    // "already exists" is not an error — fetch the existing URL
    if (err?.http_code === 400 && err?.message?.includes('already exists')) {
      try {
        const info = await cloudinary.api.resource(urlToPublicId(originalUrl));
        return info.secure_url;
      } catch (_) {}
    }
    console.warn('[imageCache] upload failed, keeping original:', originalUrl, err?.message);
    return originalUrl;
  }
}

// Cache an array of image URLs. Returns a new array with Cloudinary URLs where
// successful; original URLs where not. Processes sequentially to respect rate limits.
async function cacheImages(urls = []) {
  if (!ENABLED) return urls;
  const results = [];
  for (const url of urls) {
    results.push(await cacheOne(url));
  }
  return results;
}

module.exports = { cacheImages };
