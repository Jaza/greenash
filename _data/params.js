module.exports = {
  lang: 'en-AU',
  baseURL: process.env.GREENASH_BASE_URL,
  uploadsBaseURL: process.env.GREENASH_UPLOADS_BASE_URL,
  cloudflareAnalyticsToken: process.env.CLOUDFLARE_ANALYTICS_TOKEN,
  recaptchaKey: process.env.SITE_RECAPTCHA_KEY,
  authorName: 'Jaza',
  authorURL: 'https://greenash.net.au',
  footerText: `ABN: 58 377 192 424<br>&copy; 2004-${new Date().getFullYear()} Jeremy Epstein. <a href="/legal/">Legalities</a> apply.`,
  jazaDob: '1986-01-03'
};
