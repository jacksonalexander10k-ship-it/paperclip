/**
 * Express 5 + supertest compatibility shim for Node 20 on macOS.
 *
 * Root cause: on macOS, `server.listen(0)` with no explicit host binds to the
 * IPv6 wildcard `::` with IPV6_V6ONLY=true (macOS default). supertest then
 * tries to connect to `127.0.0.1` (IPv4), which never reaches the IPv6-only
 * server — every request hangs indefinitely.
 *
 * Fix: patch supertest's `serverAddress()` method to use `[::1]` (IPv6
 * loopback) instead of `127.0.0.1` when the server is listening on `::`.
 * This matches the actual interface the OS bound to.
 */

// Resolved via require() because supertest is CJS and this file runs before
// any test imports supertest themselves.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Test = require("supertest/lib/test") as {
  prototype: { serverAddress(app: { address(): { address: string; port: number } | null }, path: string): string };
};

const _serverAddress = Test.prototype.serverAddress;

Test.prototype.serverAddress = function (app, path) {
  const url = _serverAddress.call(this, app, path);
  // If the server is on :: (IPv6 wildcard, macOS default for listen(0)),
  // rewrite the URL to use [::1] so the request actually reaches it.
  const addr = app.address();
  if (addr && addr.address === "::") {
    return url.replace("127.0.0.1", "[::1]");
  }
  return url;
};
