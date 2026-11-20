import app from "vinext/server/fetch-handler";

const heroPath = "/videos/growvelt-learning-reel-v1.mp4";

export default {
  async fetch(request, env, ctx) {
    const range = request.headers.get("Range");
    const match = range && /^bytes=(\d*)-(\d*)$/i.exec(range);
    if (request.method !== "GET" || new URL(request.url).pathname !== heroPath ||
        !match || (!match[1] && !match[2]) || request.headers.has("If-Range")) {
      return app.fetch(request, env, ctx);
    }

    const asset = await env.ASSETS.fetch(new Request(request.url));
    if (asset.status !== 200) return asset;

    const bytes = await asset.arrayBuffer();
    const size = bytes.byteLength;
    const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
    const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    const headers = new Headers({
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
    });

    if (start >= size || end < start) {
      headers.set("Content-Range", `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }

    headers.set("Content-Type", "video/mp4");
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(bytes.slice(start, end + 1), { status: 206, headers });
  },
};
