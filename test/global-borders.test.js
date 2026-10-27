/**
 * @file global-borders.test.js
 * Global border (WO-585): actions → POST /api/scene/global-border, state ingest → variables +
 * feedback, presets.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import getGlobalBorderActions, {
  parseParamValue,
} from "../src/actions/global-border-actions.js";
import {
  getGlobalBorderFeedbacks,
  globalBorderVariableDefinitions,
  ingestGlobalBorders,
} from "../src/global-borders.js";
import { addGlobalBorderPresets } from "../src/presets/global-border-presets.js";

function stubInstance(reply = (body) => ({ ok: true, border: null, body })) {
  const calls = [];
  const inst = {
    calls,
    logs: [],
    vars: {},
    checked: [],
    label: "hc",
    _channelMap: { screenCount: 2, screenLabels: ["Main", ""] },
    _globalBorders: [],
    log(level, msg) {
      this.logs.push(`${level}: ${msg}`);
    },
    setVariableValues(v) {
      Object.assign(this.vars, v);
    },
    checkFeedbacks(...ids) {
      this.checked.push(...ids);
    },
    bridge: {
      api: {
        async globalBorder(body) {
          calls.push(body);
          return reply(body);
        },
      },
    },
  };
  return inst;
}

describe("global border actions", () => {
  it("on / off / toggle map to enabled", async () => {
    const inst = stubInstance();
    const a = getGlobalBorderActions(inst);
    for (const state of ["on", "off", "toggle"]) {
      await a.global_border_set.callback({ options: { screen: "1", state } });
    }
    assert.deepEqual(inst.calls, [
      { screen: 1, enabled: true },
      { screen: 1, enabled: false },
      { screen: 1, enabled: "toggle" },
    ]);
  });

  it("the reply's border updates feedback + variables right away", async () => {
    const inst = stubInstance(() => ({
      ok: true,
      border: { enabled: true, type: "glow", params: { color: "#00ff00" } },
    }));
    await getGlobalBorderActions(inst).global_border_set.callback({
      options: { screen: "0", state: "on" },
    });
    assert.equal(inst.vars.highascg_global_border_1_state, "ON");
    assert.equal(inst.vars.highascg_global_border_1_type, "glow");
    assert.equal(inst.vars.highascg_global_border_1_opacity, "100");
    const fb = getGlobalBorderFeedbacks(inst).global_border_on;
    assert.equal(fb.callback({ options: { screen: "0" } }), true);
    assert.equal(fb.callback({ options: { screen: "1" } }), false);
  });

  it("colour, opacity (with nudge), param, type, fade and preset bodies", async () => {
    const inst = stubInstance();
    inst._globalBorders = [
      { enabled: true, params: { opacity: 0.5, speed: 400 } },
    ];
    const a = getGlobalBorderActions(inst);
    await a.global_border_color.callback({
      options: { screen: "0", key: "glowColor", color: "#123456" },
    });
    await a.global_border_opacity.callback({
      options: { screen: "0", opacity: "+20" },
    });
    await a.global_border_param.callback({
      options: { screen: "0", key: "speed", value: "-100" },
    });
    await a.global_border_param.callback({
      options: { screen: "0", key: "pulse", value: "true" },
    });
    await a.global_border_type.callback({
      options: { screen: "0", type: "edge_strip" },
    });
    await a.global_border_fade.callback({
      options: { screen: "0", frames: 0 },
    });
    await a.global_border_preset.callback({
      options: { screen: "0", slot: 3 },
    });
    assert.deepEqual(inst.calls, [
      { screen: 0, params: { glowColor: "#123456" } },
      { screen: 0, params: { opacity: 0.7 } },
      { screen: 0, params: { speed: 300 } },
      { screen: 0, params: { pulse: true } },
      { screen: 0, type: "edge_strip" },
      { screen: 0, fadeDuration: 0 },
      { screen: 0, preset: 3 },
    ]);
  });

  it("a bad parameter value logs and sends nothing", async () => {
    const inst = stubInstance();
    await getGlobalBorderActions(inst).global_border_param.callback({
      options: { screen: "0", key: "width", value: "wide" },
    });
    assert.equal(inst.calls.length, 0);
    assert.match(inst.logs[0], /not a value for width/);
  });

  it("API errors are logged, not thrown", async () => {
    const inst = stubInstance(() => {
      throw new Error("border preset 3 is empty");
    });
    await getGlobalBorderActions(inst).global_border_preset.callback({
      options: { screen: "0", slot: 3 },
    });
    assert.match(inst.logs[0], /preset \(screen 1\): border preset 3 is empty/);
  });

  it("parseParamValue", () => {
    assert.equal(parseParamValue("", 1), null);
    assert.equal(parseParamValue("abc", 1), null);
    assert.equal(parseParamValue("12", 1), 12);
    assert.equal(parseParamValue("+0.1", 0.2), 0.3);
    assert.equal(parseParamValue("-5", undefined), -5);
    assert.equal(parseParamValue("off", 1), false);
  });
});

describe("global border state", () => {
  it("ingest publishes per-screen variables and only re-checks on change", () => {
    const inst = stubInstance();
    const arr = [
      {
        enabled: false,
        type: "edge_strip",
        params: { color: "#ff7800", opacity: 0.25 },
      },
      null,
    ];
    ingestGlobalBorders(inst, arr);
    assert.equal(inst.vars.highascg_global_border_1_state, "OFF");
    assert.equal(inst.vars.highascg_global_border_1_color, "#ff7800");
    assert.equal(inst.vars.highascg_global_border_1_opacity, "25");
    assert.equal(inst.vars.highascg_global_border_2_state, "");
    assert.deepEqual(inst.checked, ["global_border_on"]);
    ingestGlobalBorders(inst, arr);
    assert.deepEqual(inst.checked, ["global_border_on"]);
    ingestGlobalBorders(inst, undefined);
    assert.equal(inst._globalBorders[0].type, "edge_strip");
  });

  it("defines state/type/colour/opacity for four screens", () => {
    assert.equal(globalBorderVariableDefinitions().length, 16);
  });
});

describe("global border presets", () => {
  it("one toggle per screen, with the on feedback", () => {
    const out = [];
    addGlobalBorderPresets(stubInstance(), (section, key, p) =>
      out.push({ section, key, p }),
    );
    assert.deepEqual(
      out.map((o) => o.key),
      ["global_border_toggle_1", "global_border_toggle_2"],
    );
    assert.equal(out[0].section, "global_border");
    assert.equal(out[1].p.steps[0].down[0].options.screen, "1");
    assert.equal(out[0].p.feedbacks[0].feedbackId, "global_border_on");
    assert.match(out[0].p.style.text, /\$\(hc:highascg_screen_1_label\)/);
  });
});
