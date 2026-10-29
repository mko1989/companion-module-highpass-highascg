/**
 * @file auth-headers.test.js
 * WO-811: Bearer password on every HTTP request and on the WebSocket upgrade.
 */

import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { WebSocketServer } from "ws";

import { authHeaders, withAuth } from "../src/bridge/auth-headers.js";
import { HighAsCGApi } from "../src/bridge/api-client.js";
import { HighAsCGWs } from "../src/bridge/ws-client.js";
import getConfigFields from "../src/config-fields.js";

describe("authHeaders", () => {
  it("returns {} for empty, whitespace or missing password", () => {
    assert.deepEqual(authHeaders({ api_password: "" }), {});
    assert.deepEqual(authHeaders({ api_password: "   " }), {});
    assert.deepEqual(authHeaders({}), {});
    assert.deepEqual(authHeaders(undefined), {});
    assert.deepEqual(authHeaders({ api_password: null }), {});
  });
  it("returns a Bearer header (trimmed) for a password", () => {
    assert.deepEqual(authHeaders({ api_password: " s3cret " }), {
      Authorization: "Bearer s3cret",
    });
  });
  it("withAuth merges and keeps existing headers", () => {
    assert.deepEqual(withAuth({ A: "1" }, { api_password: "x" }), {
      A: "1",
      Authorization: "Bearer x",
    });
    assert.deepEqual(withAuth({ A: "1" }, {}), { A: "1" });
  });
  it("config exposes api_password as optional secret-text", () => {
    const f = getConfigFields().find((x) => x.id === "api_password");
    assert.equal(f.type, "secret-text");
    assert.equal(f.default, "");
    assert.equal(f.regex, undefined);
  });
});

function listen(server) {
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve(server.address().port)),
  );
}

describe("call sites send the header", () => {
  const seen = [];
  const server = http.createServer((req, res) => {
    seen.push(req.headers);
    res.setHeader("content-type", "application/json");
    res.end("{}");
  });
  const wss = new WebSocketServer({ noServer: true });
  const upgrades = [];
  server.on("upgrade", (req, sock, head) => {
    upgrades.push(req.headers);
    wss.handleUpgrade(req, sock, head, (ws) => ws.close());
  });
  let port;
  const mk = (config) => ({
    config: { ...config, highascg_port: port },
    getActiveHost: () => "127.0.0.1",
    log() {},
    updateStatus() {},
    checkFeedbacks() {},
  });

  it("starts", async () => {
    port = await listen(server);
  });
  after(() => {
    wss.close();
    server.closeAllConnections?.();
    server.close();
  });

  it("api-client GET and POST carry Authorization, follow config changes", async () => {
    const inst = mk({ api_password: "pw1" });
    const api = new HighAsCGApi(inst);
    await api._get("/api/state");
    await api._post("/api/x", {});
    assert.equal(seen.at(-2).authorization, "Bearer pw1");
    assert.equal(seen.at(-1).authorization, "Bearer pw1");
    assert.equal(seen.at(-1)["content-type"], "application/json");
    inst.config.api_password = "pw2";
    await api._get("/api/state");
    assert.equal(seen.at(-1).authorization, "Bearer pw2");
  });

  it("api-client sends no Authorization with empty password", async () => {
    const api = new HighAsCGApi(mk({ api_password: "" }));
    await api._get("/api/state");
    await api._post("/api/x", {});
    assert.equal(seen.at(-2).authorization, undefined);
    assert.equal(seen.at(-1).authorization, undefined);
  });

  it("WS upgrade carries Authorization only when a password is set", async () => {
    for (const [pw, want] of [
      ["wspw", "Bearer wspw"],
      ["", undefined],
    ]) {
      const before = upgrades.length;
      const c = new HighAsCGWs(mk({ api_password: pw }));
      for (let i = 0; i < 100 && upgrades.length === before; i++)
        await new Promise((r) => setTimeout(r, 20));
      c._destroyed = true;
      c.ws?.terminate();
      if (c.reconnectTimer) clearTimeout(c.reconnectTimer);
      assert.equal(upgrades.length, before + 1);
      assert.equal(upgrades.at(-1).authorization, want);
    }
  });
});

describe("Companion 5 secrets argument (WO-811, 1.0.2)", () => {
  // Companion 5 never puts secret-text fields in `config`; 1.0.1 dropped the `secrets` argument and sent no header.
  const stub = async () => {
    const { HighAsCGInstance } = await import("../src/instance.js");
    const calls = [];
    const self = {
      updateStatus() {},
      initConnectionRouter() {},
      initBridge() {
        calls.push("bridge");
      },
      _syncConnectionVariables() {},
      updateActions() {},
      updateFeedbacks() {},
      updateVariables() {},
      updatePresets() {},
      reconnectAll() {
        calls.push("reconnect");
      },
    };
    return { P: HighAsCGInstance.prototype, self, calls };
  };

  it("init: the password from secrets reaches the Authorization header", async () => {
    const { P, self } = await stub();
    await P.init.call(self, { box_host: "10.0.0.5" }, false, {
      api_password: "s5",
    });
    assert.equal(self.config.api_password, "s5");
    assert.deepEqual(authHeaders(self.config), { Authorization: "Bearer s5" });
    assert.equal(self.config.box_host, "10.0.0.5");
  });

  it("configUpdated: a new password from secrets reconnects the WebSocket; same password does not", async () => {
    const { P, self, calls } = await stub();
    await P.init.call(self, { box_host: "h" }, false, { api_password: "a" });
    await P.configUpdated.call(self, { box_host: "h" }, { api_password: "a" });
    assert.equal(calls.includes("reconnect"), false);
    await P.configUpdated.call(self, { box_host: "h" }, { api_password: "b" });
    assert.equal(self.config.api_password, "b");
    assert.equal(calls.filter((c) => c === "reconnect").length, 1);
  });

  it("no secrets argument (older Companion): a password in config still works", async () => {
    const { P, self } = await stub();
    await P.init.call(
      self,
      { box_host: "h", api_password: "old" },
      false,
      undefined,
    );
    assert.equal(self.config.api_password, "old");
  });
});
