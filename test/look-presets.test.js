/**
 * @file look-presets.test.js
 * Look presets (HighAsCG scenes.lookPresets): recall modes → POST /api/scene/look-preset/recall,
 * list ingest, PGM / PRV tally, preset buttons.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import getLookPresetActions from "../src/actions/look-preset-actions.js";
import {
  getLookPresetFeedbacks,
  ingestLookPresets,
  normalizeLookPresets,
} from "../src/look-presets.js";
import { addLookPresetPresets } from "../src/presets/look-preset-presets.js";
import getPresets from "../src/presets.js";

const PRESETS = [
  {
    id: "p1",
    name: "Intro",
    items: [
      { mainIdx: 0, sceneId: "a", sourceKind: "prv" },
      { mainIdx: 1, sceneId: "b", sourceKind: "prv" },
    ],
  },
  {
    id: "p2",
    name: "Half",
    items: [
      { mainIdx: 0, sceneId: "c" },
      { mainIdx: 1, empty: true },
    ],
  },
];

function stubInstance(reply = () => ({ ok: true, items: [] })) {
  const calls = [];
  return {
    calls,
    logs: [],
    checked: [],
    updates: 0,
    _lookPresets: [],
    _lookPresetsSig: "",
    _channelMap: { programChannels: [1, 3], previewChannels: [2, 4] },
    _sceneLive: {},
    log(level, msg) {
      this.logs.push(`${level}: ${msg}`);
    },
    checkFeedbacks(...ids) {
      this.checked.push(...ids);
    },
    updateActions() {
      this.updates += 1;
    },
    updatePresets() {},
    bridge: {
      api: {
        async recallLookPreset(body) {
          calls.push(body);
          return reply(body);
        },
      },
    },
  };
}

describe("look preset recall", () => {
  it("PRV, PGM cut and auto take send the preset card requests", async () => {
    const inst = stubInstance();
    const a = getLookPresetActions(inst).look_preset_recall;
    await a.callback({ options: { preset_id: "p1", mode: "preview" } });
    await a.callback({ options: { preset_id: "p1", mode: "program" } });
    await a.callback({ options: { preset_id: "p1", mode: "auto" } });
    assert.deepEqual(inst.calls, [
      { id: "p1", target: "preview" },
      { id: "p1", target: "program", forceCut: true },
      // auto: PRV first, then the ▶ take (each look's own transition)
      { id: "p1", target: "preview" },
      {
        id: "p1",
        target: "program",
        forceCut: false,
        useGlobalTransition: false,
      },
    ]);
  });

  it("auto take can use the deck default transition; a missing mode is auto", async () => {
    const inst = stubInstance();
    const a = getLookPresetActions(inst).look_preset_recall;
    await a.callback({ options: { preset_id: "p1", global_transition: true } });
    assert.deepEqual(inst.calls[1], {
      id: "p1",
      target: "program",
      forceCut: false,
      useGlobalTransition: true,
    });
  });

  it("per-screen errors and a failed request are logged; no preset sends nothing", async () => {
    const inst = stubInstance(() => ({
      ok: false,
      items: [{ mainIdx: 1, error: "no program channel" }],
    }));
    const a = getLookPresetActions(inst).look_preset_recall;
    await a.callback({ options: { preset_id: "p1", mode: "program" } });
    assert.match(inst.logs.at(-1), /^warn: .*screen 2: no program channel/);
    inst.bridge.api.recallLookPreset = async () => {
      throw new Error("HTTP 404: not found");
    };
    await a.callback({ options: { preset_id: "gone", mode: "preview" } });
    assert.match(inst.logs.at(-1), /^error: .*HTTP 404/);
    await a.callback({ options: { preset_id: "", mode: "preview" } });
    assert.match(inst.logs.at(-1), /^warn: Choose a look preset/);
  });
});

describe("look preset list", () => {
  it("normalizes items, empty destinations and legacy single-look presets", () => {
    const n = normalizeLookPresets([
      ...PRESETS,
      { id: "old", name: "Legacy", sceneId: "z", targetMain: 1 },
      { name: "no id" },
    ]);
    assert.deepEqual(
      n.map((p) => p.id),
      ["p1", "p2", "old"],
    );
    assert.deepEqual(n[1].items[1], { mainIdx: 1, sceneId: "", empty: true });
    assert.deepEqual(n[2].items, [{ mainIdx: 1, sceneId: "z", empty: false }]);
  });

  it("ingest rebuilds actions only when the list changed", () => {
    const inst = stubInstance();
    ingestLookPresets(inst, PRESETS);
    ingestLookPresets(inst, JSON.parse(JSON.stringify(PRESETS)));
    assert.equal(inst.updates, 1);
    assert.equal(inst._lookPresets.length, 2);
    ingestLookPresets(inst, undefined); // a payload without the key keeps the list
    assert.equal(inst._lookPresets.length, 2);
    const dd = getLookPresetActions(inst).look_preset_recall.options[0];
    assert.deepEqual(
      dd.choices.map((c) => c.id),
      ["p1", "p2"],
    );
  });
});

describe("look preset tally", () => {
  it("on PGM / PRV only when every destination holds its look", () => {
    const inst = stubInstance();
    ingestLookPresets(inst, PRESETS);
    const fb = getLookPresetFeedbacks(inst);
    const on = (id, kind) =>
      fb[`look_preset_on_${kind}`].callback({ options: { preset_id: id } });
    inst._sceneLive = { 1: { sceneId: "a" }, 2: { sceneId: "a" } };
    assert.equal(on("p1", "pgm"), false); // screen 2 not there yet
    inst._sceneLive[3] = { sceneId: "b" };
    assert.equal(on("p1", "pgm"), true);
    assert.equal(on("p1", "prv"), false);
    inst._sceneLive[4] = { sceneId: "b" };
    assert.equal(on("p1", "prv"), true);
    // an empty destination counts when nothing is live there
    inst._sceneLive = { 1: { sceneId: "c" } };
    assert.equal(on("p2", "pgm"), true);
    inst._sceneLive[3] = { sceneId: "x" };
    assert.equal(on("p2", "pgm"), false);
    assert.equal(on("nope", "pgm"), false);
  });
});

describe("look preset buttons", () => {
  it("one PRV / PGM / AUTO row per preset, PGM tally last", () => {
    const inst = stubInstance();
    ingestLookPresets(inst, PRESETS);
    const added = [];
    addLookPresetPresets(inst, (section, key, p) =>
      added.push({ section, key, p }),
    );
    assert.equal(added.length, 6);
    assert.ok(added.every((x) => x.section === "look_presets"));
    assert.deepEqual(
      added.slice(0, 3).map((x) => x.p.steps[0].down[0].options.mode),
      ["preview", "program", "auto"],
    );
    assert.deepEqual(
      added[0].p.feedbacks.map((f) => f.feedbackId),
      ["look_preset_on_prv", "look_preset_on_pgm"],
    );
  });

  it("the preset catalog has the section filled", () => {
    const inst = {
      ...stubInstance(),
      label: "highascg",
      config: {},
      _presetLooks: [],
      _lookSlots: {},
      getLookIdForSlot: () => "",
    };
    ingestLookPresets(inst, PRESETS);
    const { structure, presets } = getPresets(inst);
    const sec = structure.find((s) => s.id === "look_presets");
    assert.equal(sec.definitions.length, 6);
    assert.ok(sec.definitions.every((k) => presets[k]));
  });
});
