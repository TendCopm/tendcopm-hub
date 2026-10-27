/* Pages Function for /portal/assets/maps-config.js
 * Injects GOOGLE_MAPS_API_KEY when the Pages project has it.
 * With no env var, the static file in public/ is served unchanged.
 */
export async function onRequest(context) {
  const env = context && context.env;
  const key = String((env && env.GOOGLE_MAPS_API_KEY) || '').trim();
  if (!key) {
    if (context && typeof context.next === 'function') return context.next();
    return new Response("window.TENDCO_MAPS_KEY='';\n", {
      headers: {
        'content-type': 'application/javascript; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  }
  return new Response('window.TENDCO_MAPS_KEY=' + JSON.stringify(key) + ';\n', {
    headers: {
      'content-type': 'application/javascript; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
