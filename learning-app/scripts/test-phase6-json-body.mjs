import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../app/lib/security/json-body.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleValue = { exports: {} };
vm.runInNewContext(compiled, { module: moduleValue, exports: moduleValue.exports, TextDecoder });
const { JsonBodyError, readBoundedJson, readBoundedJsonObject } = moduleValue.exports;
const encode = text => new TextEncoder().encode(text);
const request = (body, headers = {}) => new Request("http://127.0.0.1/api/local-fixture", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body });
const rejects = (promise, status) => assert.rejects(promise, error => error instanceof JsonBodyError && error.status === status);
const payload = '{"text":"hello"}';
assert.equal((await readBoundedJson(request(payload), encode(payload).byteLength)).text, "hello");
assert.equal((await readBoundedJson(request(payload, { "Content-Type": "application/json; charset=utf-8" }), 100)).text, "hello");
await rejects(readBoundedJson(request(payload, { "Content-Type": "text/plain" }), 100), 415);
await rejects(readBoundedJson(request("{broken"), 100), 400);
await rejects(readBoundedJson(request(""), 100), 400);
await rejects(readBoundedJson(request(payload), 3), 413);
await rejects(readBoundedJson(request(payload, { "Content-Length": "1" }), 3), 413);
await rejects(readBoundedJson(request(payload, { "Content-Length": "invalid" }), 100), 400);
await rejects(readBoundedJson(request(payload, { "Content-Length": "100000" }), 100), 413);
await rejects(readBoundedJson(request('"éééé"'), 7), 413, "limits count UTF-8 bytes, not characters");
await rejects(readBoundedJson(request(new Uint8Array([34, 255, 34])), 100), 400);

const bytes = encode('{"text":"你好🌍"}');
const fragmented = new ReadableStream({ start(controller) { for (const byte of bytes) controller.enqueue(Uint8Array.of(byte)); controller.close(); } });
const fragmentedRequest = new Request("http://127.0.0.1/api/local-fixture", { method: "POST", headers: { "Content-Type": "application/json" }, body: fragmented, duplex: "half" });
assert.equal((await readBoundedJson(fragmentedRequest, bytes.length)).text, "你好🌍", "decoder preserves characters split across chunks");

let cancelled = false;
const stream = new ReadableStream({ pull(controller) { controller.enqueue(encode("12345678")); }, cancel() { cancelled = true; } });
const streamedRequest = new Request("http://127.0.0.1/api/local-fixture", { method: "POST", headers: { "Content-Type": "application/json" }, body: stream, duplex: "half" });
await rejects(readBoundedJson(streamedRequest, 10), 413);
assert.equal(cancelled, true, "oversized chunked requests cancel their reader");
assert.equal(stream.locked, false, "reader lock is released after rejection");

let reads = 0;
await rejects(readBoundedJson({ headers: new Headers({ "Content-Type": "application/json", "Content-Length": "1025" }), body: { getReader() { reads++; throw new Error("must not read"); } } }, 1024), 413);
assert.equal(reads, 0, "declared oversize is rejected before reading any bytes");
for (const value of ["null", "[]", '"text"', "true", "123"]) await rejects(readBoundedJsonObject(request(value), 100), 400);
assert.equal((await readBoundedJsonObject(request('{"marketingOptIn":false}'), 100)).marketingOptIn, false);
console.log("PASS bounded JSON: content type, exact limit, missing/forged length, streamed cancellation, invalid JSON/UTF-8, and fragmented multibyte characters. No backend or network access.");
