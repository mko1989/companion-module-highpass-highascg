/**
 * WO-394/395 — HighAsCG-only module surface:
 * - only `raw` survives from the direct-AMCP actions, and it goes through the bridge
 * - stream/record actions enumerate the CONFIGURED outputs (no free-text placeholders)
 * - presets exist per configured output, with per-output active feedbacks
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import getActions from "../src/actions/index.js";
import getFeedbacks from "../src/feedbacks.js";
import getPresets from "../src/presets.js";
import getConfigFields from "../src/config-fields.js";

function stubInstance(overrides = {}) {
  return {
    label: "highascg",
    config: {},
    _presetLooks: [],
    _lookSlots: {},
    _channelMap: { screenCount: 1, programChannels: [1] },
    _screenTimers: [],
    _streamingOutputs: {
      stream: [
        { id: "str_1", label: "YouTube", enabled: true, type: "rtmp" },
        { id: "str_2", label: "SRT feed", enabled: false, type: "srt" },
      ],
      record: [{ id: "rec_1", label: "Rec1", enabled: true }],
    },
    getLookIdForSlot() {
      return "";
    },
    getVariableValue() {
      return "";
    },
    setVariableValues() {},
    log() {},
    ...overrides,
  };
}

describe("WO-394: direct-AMCP surface removed", () => {
  const actions = getActions(stubInstance());

  it("play/stop/clear are gone; raw remains", () => {
    assert.equal(actions.play, undefined);
    assert.equal(actions.stop, undefined);
    assert.equal(actions.clear, undefined);
    assert.ok(actions.raw, "raw AMCP escape hatch must remain");
    assert.match(actions.raw.name, /HighAsCG/, "raw is framed as via-HighAsCG");
  });

  it("config no longer offers an AMCP port or a bridge on/off switch", () => {
    const ids = getConfigFields().map((f) => f.id);
    assert.ok(!ids.includes("port"), "AMCP port field must be gone");
    assert.ok(
      !ids.includes("highascg_enabled"),
      "bridge enable field must be gone",
    );
    assert.ok(ids.includes("box_host") && ids.includes("highascg_port"));
  });
});

describe("WO-395: configured-output streaming actions", () => {
  const actions = getActions(stubInstance());

  it("start actions offer exactly the configured outputs — no free-text fields", () => {
    const streamOpts = actions.rtmp_start.options;
    assert.equal(
      streamOpts.length,
      1,
      "one dropdown, no placeholder text inputs",
    );
    assert.equal(streamOpts[0].type, "dropdown");
    assert.deepEqual(
      streamOpts[0].choices.map((c) => c.id),
      ["str_1", "str_2"],
    );
    assert.match(streamOpts[0].choices[1].label, /disabled/i);

    const recOpts = actions.record_start.options;
    assert.deepEqual(
      recOpts[0].choices.map((c) => c.id),
      ["rec_1"],
    );

    const stopChoices = actions.record_stop.options[0].choices;
    assert.equal(stopChoices[0].id, "", "record stop offers All active first");
  });

  it("an empty catalog (WO-393: zero outputs) still renders a valid dropdown", () => {
    const empty = getActions(
      stubInstance({ _streamingOutputs: { stream: [], record: [] } }),
    );
    assert.equal(empty.rtmp_start.options[0].choices.length, 1);
    assert.equal(empty.rtmp_start.options[0].choices[0].id, "");
  });
});

describe("WO-395: per-output feedbacks read the raw status", () => {
  it("streaming_active matches by outputId; recording_active by activeOutputs", () => {
    const instance = stubInstance({
      _streamingChannelStatus: {
        rtmp: { active: true, outputId: "str_1" },
        record: { active: true, activeOutputs: ["rec_1"] },
      },
    });
    const fb = getFeedbacks(instance);
    assert.equal(
      fb.streaming_active.callback({ options: { output_id: "" } }),
      true,
    );
    assert.equal(
      fb.streaming_active.callback({ options: { output_id: "str_1" } }),
      true,
    );
    assert.equal(
      fb.streaming_active.callback({ options: { output_id: "str_2" } }),
      false,
    );
    assert.equal(
      fb.recording_active.callback({ options: { output_id: "rec_1" } }),
      true,
    );
    assert.equal(
      fb.recording_active.callback({ options: { output_id: "rec_9" } }),
      false,
    );
  });
});

describe("WO-395: presets per configured output", () => {
  const { structure, presets } = getPresets(stubInstance());

  it("the streaming section has start+stop per output and no AMCP play preset", () => {
    const streaming = structure.find((s) => s.id === "streaming");
    assert.ok(streaming, "streaming preset section exists");
    // 2 stream outputs × 2 + 1 record output × 2
    assert.equal(streaming.definitions.length, 6);
    assert.equal(
      presets.play_clip,
      undefined,
      "direct-AMCP play preset must be gone",
    );

    const start = presets[streaming.definitions[0]];
    assert.equal(start.steps[0].down[0].actionId, "rtmp_start");
    assert.equal(start.feedbacks[0].feedbackId, "streaming_active");
    assert.equal(start.feedbacks[0].options.output_id, "str_1");
  });
});
