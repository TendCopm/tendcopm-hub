/* Houses curb view — Street View Static key.
 * Leave this empty in git. Do not commit a real key.
 * Cloudflare Pages: set GOOGLE_MAPS_API_KEY (Preview + Production).
 * functions/portal/assets/maps-config.js replaces this file when that var is set.
 * You can also set window.TENDCO_MAPS_KEY before this script, or the
 * tendco-maps-key meta tag in app.html. Restrict the key to Street View Static
 * and your HTTP referrers. It is visible in the browser.
 */
(function () {
  if (typeof window.TENDCO_MAPS_KEY === 'string' && window.TENDCO_MAPS_KEY.trim()) return;
  window.TENDCO_MAPS_KEY = '';
})();
