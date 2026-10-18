// Test-only server: the request URL has the future hostname while the listener
// binds exclusively to loopback. No trustHostHeader or production config change.
import http from "node:http";
import next from "next";
const port = Number(process.argv[2]);
if (!["future", "bridge"].includes(process.env.GROWVELT_DOMAIN_TEST_MODE) || !Number.isInteger(port) || port < 1) throw new Error("Local domain rehearsal only");
const hostname = process.env.GROWVELT_DOMAIN_TEST_HOST || "www.growvelt.com";
if (!["www.growvelt.com", "learn.growvelt.com", "www.learn.growvelt.com"].includes(hostname)) throw new Error("Unapproved loopback fixture host");
const app = next({ dev: false, hostname, port });
await app.prepare();
const server = http.createServer(app.getRequestHandler());
server.listen(port, "127.0.0.1", () => console.log("Domain compatibility rehearsal listening on loopback"));
