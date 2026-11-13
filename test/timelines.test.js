/**
 * @file timelines.test.js
 * Timeline transport: the "Active timeline" default resolves without an id (an empty id used to do
 * nothing), toggle / stop / nudge / loop call the right endpoints, presets need no setup.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import getTimelineActions from "../src/actions/timeline-actions.js";
import {
  resolveTimelineId,
  timelineOption,
  ingestProjectTimelines,
  timelineListSignature,
} from "../src/timelines.js";
import { timelineTransportState } from "../src/timeline-feedbacks.js";
import { addTimelinePresets } from "../src/presets/timeline-presets.js";

const LIST = [
  { id: "tA", name: "Intro", duration: 10000 },
  { id: "tB", name: "Show", duration: 60000 },
];

function stub(timeline = {}) {
  const calls = [];
  const inst = {
    calls,
    logs: [],
    label: "hc",
    log(level, msg) {
      inst.logs.push(`${level}: ${msg}`);
    },
    handleBridgeState(d) {
      inst.bridge.sync._merged.timeline = {
        ...inst.bridge.sync._merged.timeline,
        ...d.timeline,
      };
    },
    bridge: {
      sync: { _merged: { timeline: { list: LIST, ...timeline } } },
      api: {
        timelinePlay: async (id, body) => calls.push(["play", id, body]),
        timelinePause: async (id) => calls.push(["pause", id]),
        timelineStop: async (id, o) => calls.push(["stop", id, o]),
        timelineSeek: async (id, ms) => calls.push(["seek", id, ms]),
        timelineLoop: async (id, on) => calls.push(["loop", id, on]),
      },
    },
  };
  return inst;
}

const press = (inst, actionId, options) =>
  getTimelineActions(inst)[actionId].callback({ options });

describe("timeline: which timeline", () => {
  it("active = playing one, else editor's, else last played, else first", () => {
    const pb = (o) => ({ timelineId: "tB", position: 0, ...o });
    assert.equal(
      resolveTimelineId(
        stub({ playback: pb({ playing: true }), activeId: "tA" }),
        "",
      ),
      "tB",
    );
    assert.equal(
      resolveTimelineId(
        stub({ playback: pb({ playing: false }), activeId: "tA" }),
        "",
      ),
      "tA",
    );
    assert.equal(
      resolveTimelineId(stub({ playback: pb({ playing: false }) }), ""),
      "tB",
    );
    assert.equal(resolveTimelineId(stub({}), ""), "tA");
    assert.equal(resolveTimelineId(stub({ list: [] }), ""), "");
  });
  it("an id or a name (any case) picks that timeline", () => {
    assert.equal(resolveTimelineId(stub(), "tB"), "tB");
    assert.equal(resolveTimelineId(stub(), "show"), "tB");
  });
  it("dropdown lists Active first, then the show's timelines by name", () => {
    const o = timelineOption(stub());
    assert.equal(o.type, "dropdown");
    assert.equal(o.default, "");
    assert.deepEqual(
      o.choices.map((c) => c.label),
      ["Active timeline", "Intro", "Show"],
    );
  });
  it("project_sync carries the list and the editor's timeline", () => {
    const inst = stub({ list: [] });
    ingestProjectTimelines(inst, {
      timelines: { timelines: LIST, activeId: "tB" },
    });
    assert.equal(resolveTimelineId(inst, ""), "tB");
    assert.notEqual(timelineListSignature([]), timelineListSignature(LIST));
  });
});

describe("timeline: transport presses", () => {
  it("a blank id plays the active timeline on its own routing", async () => {
    const inst = stub({ activeId: "tA" });
    await press(inst, "timeline_play", { id: "", from_ms: "" });
    assert.deepEqual(inst.calls, [["play", "tA", {}]]);
  });
  it("override routing sends sendTo", async () => {
    const inst = stub();
    await press(inst, "timeline_play", {
      id: "tB",
      from_ms: "1500",
      override_routing: true,
      screen_index: 1,
      tl_preview: false,
      tl_program: true,
    });
    assert.deepEqual(inst.calls, [
      [
        "play",
        "tB",
        { from: 1500, sendTo: { preview: false, program: true, screenIdx: 1 } },
      ],
    ]);
  });
  it("toggle pauses a playing timeline and plays a paused one", async () => {
    const playing = stub({
      playback: { timelineId: "tB", playing: true, position: 3000 },
    });
    await press(playing, "timeline_toggle", { id: "" });
    assert.deepEqual(playing.calls, [["pause", "tB"]]);
    const paused = stub({
      playback: { timelineId: "tB", playing: false, position: 3000 },
    });
    await press(paused, "timeline_toggle", { id: "tB" });
    assert.deepEqual(paused.calls, [["play", "tB", {}]]);
  });
  it("stop is forced by default (server refuses a PGM stop without force)", async () => {
    const inst = stub();
    await press(inst, "timeline_stop", { id: "tA", force: true });
    await press(inst, "timeline_stop", { id: "tA", force: false });
    assert.deepEqual(inst.calls, [
      ["stop", "tA", { force: true }],
      ["stop", "tA", { force: false }],
    ]);
  });
  it("jump moves from the playhead and clamps at 0", async () => {
    const inst = stub({
      playback: { timelineId: "tB", playing: true, position: 3000 },
    });
    await press(inst, "timeline_nudge", { id: "", delta_ms: 5000 });
    await press(inst, "timeline_nudge", { id: "", delta_ms: -5000 });
    assert.deepEqual(inst.calls, [
      ["seek", "tB", 8000],
      ["seek", "tB", 0],
    ]);
  });
  it("loop toggles from the current state; old checkbox buttons still work", async () => {
    const inst = stub({
      playback: { timelineId: "tB", loop: true, playing: true },
    });
    await press(inst, "timeline_loop", { id: "", mode: "toggle" });
    await press(inst, "timeline_loop", { id: "tB", loop: true });
    assert.deepEqual(inst.calls, [
      ["loop", "tB", false],
      ["loop", "tB", true],
    ]);
  });
  it("no timeline in the show: logged, no call", async () => {
    const inst = stub({ list: [] });
    await press(inst, "timeline_play", { id: "" });
    assert.equal(inst.calls.length, 0);
    assert.match(inst.logs.join("\n"), /no timeline/);
  });
  it("a server error is logged with the timeline name", async () => {
    const inst = stub();
    inst.bridge.api.timelinePause = async () => {
      throw new Error("HTTP 500: x");
    };
    await press(inst, "timeline_pause", { id: "tB" });
    assert.match(inst.logs.join("\n"), /pause "Show": HTTP 500/);
  });
});

describe("timeline: tally + presets", () => {
  it("state: playing / paused / stopped", () => {
    const s = (pb) => timelineTransportState(stub({ playback: pb }), "tB");
    assert.equal(
      s({ timelineId: "tB", playing: true, position: 10 }),
      "playing",
    );
    assert.equal(
      s({ timelineId: "tB", playing: false, position: 10 }),
      "paused",
    );
    assert.equal(
      s({ timelineId: "tB", playing: false, position: 0 }),
      "stopped",
    );
    assert.equal(
      s({ timelineId: "tA", playing: true, position: 10 }),
      "stopped",
    );
  });
  it("presets: active row + play/pause and stop per timeline, none with an empty-id trap", () => {
    const got = {};
    addTimelinePresets(stub(), (sec, key, p) => (got[key] = p));
    for (const k of [
      "tl_toggle_active",
      "tl_stop_active",
      "tl_rewind_active",
      "tl_back_active",
      "tl_fwd_active",
      "tl_loop_active",
      "tl_toggle_tA",
      "tl_stop_tB",
    ]) {
      assert.ok(got[k], k);
    }
    assert.equal(got.tl_toggle_tB.steps[0].down[0].options.id, "tB");
    assert.equal(got.tl_stop_active.steps[0].down[0].options.force, true);
    assert.equal(
      got.tl_toggle_active.feedbacks[0].feedbackId,
      "timeline_state",
    );
  });
  it("every preset action and feedback carries all options of its definition", async () => {
    const inst = stub();
    const actions = getTimelineActions(inst);
    const { getTimelineFeedbacks } =
      await import("../src/timeline-feedbacks.js");
    const feedbacks = getTimelineFeedbacks(inst);
    const got = {};
    addTimelinePresets(inst, (sec, key, p) => (got[key] = p));
    for (const [key, p] of Object.entries(got)) {
      for (const a of p.steps[0].down) {
        for (const o of actions[a.actionId].options) {
          assert.ok(o.id in a.options, `${key}: ${a.actionId} misses ${o.id}`);
        }
      }
      for (const f of p.feedbacks) {
        for (const o of feedbacks[f.feedbackId].options) {
          assert.ok(
            o.id in f.options,
            `${key}: ${f.feedbackId} misses ${o.id}`,
          );
        }
      }
    }
  });
  it("upgrade script fills the routing options a 1.0.3 / 1.0.4 preset button lacks", async () => {
    const { fillTimelineRoutingOptions } = await import("../src/upgrades.js");
    const old = {
      id: "a1",
      controlId: "c1",
      actionId: "timeline_toggle",
      options: {
        id: { isExpression: false, value: "" },
        override_routing: { isExpression: false, value: false },
      },
    };
    const fine = {
      id: "a2",
      controlId: "c1",
      actionId: "timeline_stop",
      options: {},
    };
    const r = fillTimelineRoutingOptions(
      {},
      { actions: [old, fine], feedbacks: [] },
    );
    assert.deepEqual(
      r.updatedActions.map((a) => a.id),
      ["a1"],
    );
    assert.deepEqual(old.options.screen_index, {
      isExpression: false,
      value: 0,
    });
    assert.deepEqual(old.options.tl_program, {
      isExpression: false,
      value: true,
    });
    assert.equal(
      fillTimelineRoutingOptions({}, { actions: [old] }).updatedActions.length,
      0,
    );
  });
});
