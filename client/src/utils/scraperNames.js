const SCRAPER_NAMES = {
  autoadsja: 'AutoAds JA',
  kms: 'KMS',
  jamaicaonlineclassifieds: 'Jamaica Classifieds',
  jacars: 'JaCars',
  jco: 'JCO',
};

export const scraperName = (raw) => SCRAPER_NAMES[raw] ?? raw;
