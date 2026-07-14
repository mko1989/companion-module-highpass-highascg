import test from "node:test";
import assert from "node:assert";
import { buildWolPacket } from "../src/actions/wol-actions.js";

test("buildWolPacket", async (t) => {
  await t.test("returns a 102-byte buffer", () => {
    const packet = buildWolPacket("AA:BB:CC:DD:EE:FF");
    assert.strictEqual(packet.length, 102);
    assert(Buffer.isBuffer(packet));
  });

  await t.test("first 6 bytes are 0xFF", () => {
    const packet = buildWolPacket("AA:BB:CC:DD:EE:FF");
    for (let i = 0; i < 6; i++) {
      assert.strictEqual(packet[i], 0xff);
    }
  });

  await t.test("MAC bytes 6-11 match parsed MAC", () => {
    const mac = "AA:BB:CC:DD:EE:FF";
    const packet = buildWolPacket(mac);
    const expected = [0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff];
    for (let i = 0; i < 6; i++) {
      assert.strictEqual(packet[6 + i], expected[i]);
    }
  });

  await t.test("MAC is repeated 16 times", () => {
    const mac = "AA:BB:CC:DD:EE:FF";
    const packet = buildWolPacket(mac);
    const expected = [0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff];
    for (let rep = 0; rep < 16; rep++) {
      for (let i = 0; i < 6; i++) {
        assert.strictEqual(
          packet[6 + rep * 6 + i],
          expected[i],
          `MAC byte mismatch at repetition ${rep}, byte ${i}`,
        );
      }
    }
  });

  await t.test("accepts colon-separated MAC", () => {
    const packet = buildWolPacket("AA:BB:CC:DD:EE:FF");
    assert.strictEqual(packet.length, 102);
  });

  await t.test("accepts dash-separated MAC", () => {
    const packet = buildWolPacket("AA-BB-CC-DD-EE-FF");
    assert.strictEqual(packet.length, 102);
  });

  await t.test("accepts MAC with no separators", () => {
    const packet = buildWolPacket("AABBCCDDEEFF");
    assert.strictEqual(packet.length, 102);
  });

  await t.test("accepts lowercase MAC", () => {
    const packet = buildWolPacket("aa:bb:cc:dd:ee:ff");
    assert.strictEqual(packet.length, 102);
  });

  await t.test("accepts mixed case MAC", () => {
    const packet = buildWolPacket("Aa:Bb:Cc:Dd:Ee:Ff");
    assert.strictEqual(packet.length, 102);
  });

  await t.test("all variants produce same packet", () => {
    const packet1 = buildWolPacket("AA:BB:CC:DD:EE:FF");
    const packet2 = buildWolPacket("aa-bb-cc-dd-ee-ff");
    const packet3 = buildWolPacket("aabbccddeeff");
    assert.deepStrictEqual(packet1, packet2);
    assert.deepStrictEqual(packet2, packet3);
  });

  await t.test("throws on invalid MAC", () => {
    assert.throws(
      () => buildWolPacket("not-a-mac"),
      Error,
      "Should reject invalid MAC",
    );
  });

  await t.test("throws on incomplete MAC", () => {
    assert.throws(
      () => buildWolPacket("AA:BB:CC:DD:EE"),
      Error,
      "Should reject incomplete MAC",
    );
  });

  await t.test("throws on non-hex characters", () => {
    assert.throws(
      () => buildWolPacket("GG:HH:II:JJ:KK:LL"),
      Error,
      "Should reject non-hex characters",
    );
  });

  await t.test("throws on empty string", () => {
    assert.throws(
      () => buildWolPacket(""),
      Error,
      "Should reject empty string",
    );
  });
});
