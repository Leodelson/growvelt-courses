// Loopback-only visual fixture. No credentials, account data or email transport.
// node scripts/preview-email-mobile-dark.mjs
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { loadEmail, sampleEmail } from "./test-email-mobile-dark.mjs";

const { renderGrowveltEmail, renderGrowveltEmailLegacy } = loadEmail("growvelt-email-template");
const logo = readFileSync(new URL("../public/logo/growvelt-wordmark-purple-20261019.png", import.meta.url));
const fixture = { ...sampleEmail, baseUrl:"http://127.0.0.1:4318" };
const page = `<!doctype html><html><head><meta charset="utf-8"><title>Learning email mobile/desktop comparison</title>
<style>body{margin:0;padding:20px;background:#101114;color:#f4f4f5;font:15px Arial}h1{font-size:22px}h2{font-size:16px}section{display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap}iframe{border:1px solid #444;height:1250px;display:block}p{max-width:900px;line-height:1.5}a{color:#d7b7ff}</style></head>
<body><h1>Learning email compatibility — local visual check</h1><p>Desktop before/after keep the same palette and layout. Narrow previews check wrapping and dark surfaces; they do not simulate Gmail iOS auto-darkening. Fictional device/IP details only. No email is sent.</p>
<nav><a href="/">Desktop comparison</a> · <a href="/?mobile">Phone-width comparison</a></nav>
<section>WIDTHS</section></body></html>`;
const server=createServer((request,response)=>{
  const url=new URL(request.url,"http://127.0.0.1:4318");
  response.setHeader("Cache-Control","no-store");
  if(url.pathname==="/logo.png"){response.setHeader("Content-Type","image/png");response.end(logo);return;}
  response.setHeader("Content-Type","text/html; charset=utf-8");
  if(url.pathname==="/old"||url.pathname==="/new"){
    const html=(url.pathname==="/new"?renderGrowveltEmail:renderGrowveltEmailLegacy)(fixture);
    response.end(html.replaceAll("https://www.growvelt.com/logo/growvelt-wordmark-purple-20261019.png","/logo.png"));return;
  }
  const mobile=url.searchParams.has("mobile");
  response.end(page.replace("WIDTHS",(mobile?[390,414]:[680,680]).map((width,index)=>`<article><h2>${mobile?`${width}px updated`:(index?"After":"Before")}</h2><iframe title="${mobile?`Updated ${width}`:(index?"After":"Before")}" width="${width}" src="/${mobile||index?"new":"old"}"></iframe></article>`).join("")));
});
server.listen(4318,"127.0.0.1",()=>console.log("Local visual fixture: http://127.0.0.1:4318 (no email transport)"));
