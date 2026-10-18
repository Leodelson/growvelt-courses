// Test-only server: the request URL has the future hostname while the listener
// binds exclusively to loopback. No trustHostHeader or production config change.
import http from "node:http";
import next from "next";
const port = Number(process.argv[2]);
if (process.env.GROWVELT_DOMAIN_TEST_MODE !== "future" || !Number.isInteger(port) || port < 1) throw new Error("Future local rehearsal only");
const app = next({ dev: false, hostname: "www.growvelt.com", port });
await app.prepare();
const server = http.createServer(app.getRequestHandler());
server.listen(port, "127.0.0.1", () => console.log("Future-www compatibility rehearsal listening on loopback"));
