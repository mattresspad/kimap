const readMethods = { Allow: 'GET, HEAD' };

export default {
  async fetch(request, env) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(null, { status: 405, headers: readMethods });
    }
    const url = new URL(request.url);
    const artwork = env.ART_ORIGIN || 'https://kim-assets.kenshi.wiki';
    if (url.pathname.startsWith('/icons/') || url.pathname.startsWith('/data/overlays/')) {
      return Response.redirect(artwork + url.pathname + url.search, 307);
    }
    if (url.pathname === '/api.php') return new Response(null, { status: 404 });
    if (url.pathname.startsWith('/map-data/') || url.pathname.startsWith('/data/')) {
      const bootstrap = url.pathname === '/map-data/vanilla.json';
      if (!bootstrap && !/^\/data\/vanilla\//.test(url.pathname)) {
        return new Response(null, { status: 404 });
      }
      let key;
      try { key = decodeURIComponent(url.pathname.slice(1)); }
      catch { return new Response(null, { status: 400 }); }
      if (key.includes('\\') || key.split('/').some(part => !part || part === '.' || part === '..')) {
        return new Response(null, { status: 400 });
      }
      let obj;
      try {
        obj = request.method === 'HEAD' ? await env.MAP_DATA.head(key) : await env.MAP_DATA.get(key);
      } catch (error) {
        console.error('Map data storage unavailable', key, error.message);
        return new Response(null, {status:503, headers:{ 'X-KiMap-Source':'r2-error', 'Cache-Control':'no-store' }});
      }
      if (!obj) return new Response(null, { status: 404, headers: { 'X-KiMap-Source': 'r2-miss', 'Cache-Control':'no-store' } });
      const headers = new Headers({ 'X-KiMap-Source': 'r2', ETag: obj.httpEtag, 'Content-Length': String(obj.size) });
      obj.writeHttpMetadata(headers);
      headers.set('Cache-Control', key.startsWith('data/vanilla/') ? 'public, max-age=31536000, immutable' : 'no-cache');
      return new Response(request.method === 'GET' ? obj.body : null, { headers });
    }
    if (!env.SHELL) return new Response(null, { status: 404 });
    const asset = await env.SHELL.fetch(request);
    if (!asset.headers.get('content-type')?.includes('text/html')) return asset;
    const headers = new Headers(asset.headers);
    // Keep automatic zone-level HTML transforms from injecting a third-party script origin.
    headers.set('Cache-Control', 'public, no-cache, no-transform');
    headers.set('Content-Security-Policy', "default-src 'self'; connect-src 'self' " + artwork + " blob: data:; img-src 'self' " + artwork + " data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; font-src 'self' data:; object-src 'none'");
    return new Response(asset.body, { status: asset.status, headers });
  }
};
