// Short-link API for greetingcard.itzsandippal.com (Cloudflare Worker + KV binding "CARDS").
//   POST /new      body = the packed card (?w= value)  ->  {"id":"Xk2p9aB4"}
//   GET  /c/<id>   ->  the packed card as text
// The same card always gets the same id, so making a link twice does not use extra storage.
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
const ABC = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no look-alikes (0/O, 1/l/I)

async function idFor(w, len) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(w)));
  let id = ''; for (let i = 0; i < len; i++) id += ABC[h[i] % ABC.length];
  return id;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

    if (req.method === 'POST' && url.pathname === '/new') {
      const w = (await req.text()).trim();
      if (!/^[A-Za-z0-9_-]{10,4000}$/.test(w)) return new Response('bad card', { status: 400, headers: CORS });
      for (const len of [8, 12]) { // 12 only if two different cards ever share an 8-letter id
        const id = await idFor(w, len), old = await env.CARDS.get(id);
        if (old === w) return Response.json({ id }, { headers: CORS });
        if (old === null) { await env.CARDS.put(id, w); return Response.json({ id }, { headers: CORS }); }
      }
      return new Response('try again', { status: 500, headers: CORS });
    }

    const m = url.pathname.match(/^\/c\/([A-Za-z0-9]{8,12})$/);
    if (req.method === 'GET' && m) {
      const w = await env.CARDS.get(m[1]);
      if (w) return new Response(w, { headers: { ...CORS, 'Content-Type': 'text/plain', 'Cache-Control': 'public, max-age=86400' } });
    }
    return new Response('not found', { status: 404, headers: CORS });
  }
};
