import assert from "node:assert/strict";
import test from "node:test";
import { isPublicIp, validatePublicUrl } from "../services/browser-worker/src/network.ts";

// Reused from the MIT-licensed OpenMuse browser security tests (see worker README).
test("browser rejects private, special-use and encoded IP addresses", async () => {
  const blocked = [
    "127.0.0.1",
    "0.0.0.0",
    "10.0.0.1",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "100.127.255.254",
    "192.0.0.1",
    "192.0.2.1",
    "192.88.99.1",
    "198.18.0.1",
    "198.51.100.2",
    "203.0.113.1",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "::ffff:127.0.0.1",
    "::ffff:8.8.8.8",
    "fc00::1",
    "fd00::1",
    "fe80::1",
    "ff02::1",
    "2001:db8::1",
    "2001::1",
    "2002:7f00:1::1",
    "3fff::1",
  ];
  for (const address of blocked) assert.equal(isPublicIp(address), false, address);
  for (const address of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) {
    assert.equal(isPublicIp(address), true, address);
  }
  for (const url of [
    "http://2130706433",
    "http://0x7f000001",
    "http://0177.0.0.1",
    "http://127.1",
    "http://[::ffff:127.0.0.1]",
    "http://localhost.",
    "http://host.local",
    "file:///etc/passwd",
    "data:text/html,hello",
    "javascript:alert(1)",
    "https://user:password@example.com",
    "http://example.com:22",
  ])
    await assert.rejects(validatePublicUrl(url), { code: "BLOCKED_URL" }, url);
});

test("browser rejects DNS answers containing any private address and pins public resolution", async () => {
  await assert.rejects(
    validatePublicUrl("https://example.com", async () => [
      { address: "1.1.1.1", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]),
    { code: "BLOCKED_URL" },
  );
  const result = await validatePublicUrl("https://example.com/a", async () => [
    { address: "93.184.216.34", family: 4 },
  ]);
  assert.equal(result.address, "93.184.216.34");
  assert.equal(result.url.href, "https://example.com/a");
});

test("DNS failure and empty answers fail closed", async () => {
  await assert.rejects(validatePublicUrl("https://example.com", async () => []), { code: "BLOCKED_URL" });
  await assert.rejects(validatePublicUrl("https://example.com", async () => { throw new Error("DNS error"); }), { code: "DNS_UNAVAILABLE" });
});
