/**
 * @file pgm-readback.test.js
 * PGM readback (HighAsCG WO-803): a display-only button per screen showing the main PGM layer's remaining time and a
 * progress bar. Formatting, the drawn bar, the feedback (no action), the change-checked poller and the presets.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PNG } from "pngjs";

import {
  barPixels,
  BAR_WIDTH,
  drawBarPng64,
  formatRemaining,
  getPgmLayerFeedbacks,
  PGM_READBACK_FEEDBACK_ID,
  pgmLayerVariableDefinitions,
  pgmLayerVariableValues,
  readbackStyle,
} from "../src/pgm-layers.js";
import { PgmLayerPoller } from "../src/bridge/pgm-layer-poller.js";
import { addPgmReadbackPresets } from "../src/presets/pgm-readback-presets.js";
import getFeedbacks from "../src/feedbacks.js";
import getPresets from "../src/presets.js";
import getVariables from "../src/variables.js";

const live = (o = {}) => ({
  screen: 0,
  label: "Dioda",
  channel: 1,
  active: true,
  layer: 12,
  clip: "PK CLICK",
  remainingSec: 991.08,
  durationSec: 2858,
  elapsedSec: 1866.92,
  progress: 0.653,
  paused: false,
  ...o,
});
const idle = (screen) => ({
  screen,
  label: `S${screen + 1}`,
  channel: screen * 2 + 1,
  active: false,
  layer: null,
  clip: "",
  remainingSec: null,
  durationSec: null,
  elapsedSec: null,
  progress: 0,
  paused: false,
});

function stubInstance(extra = {}) {
  return {
    label: "hc",
    config: {},
    vars: {},
    checked: [],
    feedbackUpdates: 0,
    _channelMap: {
      screenCount: 2,
      programChannels: [1, 3],
      screenLabels: ["Dioda", ""],
    },
    _pgmLayers: [],
    _presetLooks: [],
    _lookSlots: {},
    getLookIdForSlot: () => "",
    log() {},
    setVariableValues(v) {
      Object.assign(this.vars, v);
    },
    checkFeedbacks(...ids) {
      this.checked.push(...ids);
    },
    updateFeedbacks() {
      this.feedbackUpdates += 1;
    },
    ...extra,
  };
}

const decode = (b64) => PNG.sync.read(Buffer.from(b64, "base64"));
const px = (png, x, y) =>
  Array.from(
    png.data.slice((y * png.width + x) * 4, (y * png.width + x) * 4 + 4),
  );

describe("WO-803 remaining time and bar", () => {
  it("mm:ss under an hour, h:mm:ss above, rounded up; unknown = --:--", () => {
    assert.equal(formatRemaining(991.08), "16:32");
    assert.equal(formatRemaining(59.2), "01:00");
    assert.equal(formatRemaining(0.4), "00:01");
    assert.equal(formatRemaining(0), "00:00");
    assert.equal(formatRemaining(3725), "1:02:05");
    assert.equal(formatRemaining(-4), "00:00");
    assert.equal(formatRemaining(null), "--:--");
    assert.equal(formatRemaining(undefined), "--:--");
  });

  it("bar pixels clamp to 0..width", () => {
    assert.equal(barPixels(0.5), 36);
    assert.equal(barPixels(1.4), BAR_WIDTH);
    assert.equal(barPixels(-1), 0);
    assert.equal(barPixels(NaN), 0);
    assert.equal(barPixels(0.25, 100), 25);
  });

  it("the drawn bar: red fill up to the progress, grey track after; amber while paused", () => {
    const png = decode(drawBarPng64(18));
    assert.equal(png.width, 72);
    assert.equal(png.height, 8);
    assert.deepEqual(px(png, 0, 0), [220, 0, 0, 255]);
    assert.deepEqual(px(png, 17, 7), [220, 0, 0, 255]);
    assert.deepEqual(px(png, 18, 0), [70, 70, 70, 255]);
    assert.deepEqual(
      px(decode(drawBarPng64(18, { paused: true })), 5, 3),
      [230, 160, 0, 255],
    );
    assert.equal(decode(drawBarPng64(10, { width: 96 })).width, 96);
  });
});

describe("WO-803 feedback", () => {
  it("live: label + remaining, bar at the bottom", () => {
    const s = readbackStyle(live(), "Dioda");
    assert.equal(s.text, "Dioda\\n16:32");
    assert.equal(s.pngalignment, "center:bottom");
    const png = decode(s.png64);
    assert.equal(png.width, 72);
    assert.deepEqual(px(png, barPixels(0.653) - 1, 0), [220, 0, 0, 255]);
    assert.deepEqual(px(png, barPixels(0.653), 0), [70, 70, 70, 255]);
  });

  it("paused marker; cleared/taken-out state is dim with no bar", () => {
    const p = readbackStyle(live({ paused: true }), "Dioda");
    assert.equal(p.text, "Dioda\\n16:32\\nPAUSED");
    const c = readbackStyle(idle(0), "Dioda");
    assert.equal(c.text, "Dioda\\n--:--");
    assert.equal(c.png64, undefined);
    assert.equal(readbackStyle(null, "S2").text, "S2\\n--:--");
  });

  it("display only: advanced feedback, screen dropdown, no action / learn; registered in the module", () => {
    const inst = stubInstance({ _pgmLayers: [live(), idle(1)] });
    const fb = getPgmLayerFeedbacks(inst)[PGM_READBACK_FEEDBACK_ID];
    assert.equal(fb.type, "advanced");
    assert.equal(fb.learn, undefined);
    assert.ok(!("action" in fb) && !("actions" in fb));
    assert.deepEqual(
      fb.options.map((o) => o.id),
      ["screen"],
    );
    assert.deepEqual(
      fb.options[0].choices.map((c) => c.label),
      ["Screen 1 · Dioda", "Screen 2"],
    );
    assert.equal(
      fb.callback({ options: { screen: "0" } }).text,
      "Dioda\\n16:32",
    );
    assert.equal(fb.callback({ options: { screen: "1" } }).text, "S2\\n--:--");
    // Companion's button size, when given, sets the bar width.
    const wide = fb.callback({
      options: { screen: "0" },
      image: { width: 96, height: 96 },
    });
    assert.equal(decode(wide.png64).width, 96);
    assert.ok(getFeedbacks(inst)[PGM_READBACK_FEEDBACK_ID]);
  });
});

describe("WO-803 poller: redraws only on change", () => {
  it("same second + same bar pixel = no redraw; a new second, pause, or clear redraws", () => {
    const inst = stubInstance();
    const p = new PgmLayerPoller(inst);
    assert.equal(p.ingest([live(), idle(1)]), true);
    assert.equal(inst.checked.length, 1);
    assert.equal(inst.vars.highascg_pgm_1_remaining, "16:32");
    assert.equal(inst.vars.highascg_pgm_1_clip, "PK CLICK");
    assert.equal(inst.vars.highascg_pgm_2_remaining, "--:--");
    // Half a second later: same displayed second, same bar pixel → nothing redrawn.
    assert.equal(
      p.ingest([live({ remainingSec: 991.5, progress: 0.6532 }), idle(1)]),
      false,
    );
    assert.equal(inst.checked.length, 1);
    assert.equal(p.ingest([live({ remainingSec: 990.5 }), idle(1)]), true);
    assert.equal(inst.vars.highascg_pgm_1_remaining, "16:31");
    assert.equal(
      p.ingest([live({ remainingSec: 990.5, paused: true }), idle(1)]),
      true,
    );
    assert.equal(p.ingest([idle(0), idle(1)]), true);
    assert.equal(inst.vars.highascg_pgm_1_remaining, "--:--");
    assert.equal(inst.vars.highascg_pgm_1_clip, "");
    assert.deepEqual([...new Set(inst.checked)], [PGM_READBACK_FEEDBACK_ID]);
    assert.equal(inst.checked.length, 4);
  });

  it("a changed screen set rebuilds the feedback dropdown (not on the first poll)", () => {
    const inst = stubInstance();
    const p = new PgmLayerPoller(inst);
    p.ingest([idle(0), idle(1)]);
    assert.equal(inst.feedbackUpdates, 0);
    p.ingest([idle(0), idle(1), idle(2)]);
    assert.equal(inst.feedbackUpdates, 1);
  });

  it("variables are defined per screen", () => {
    const ids = pgmLayerVariableDefinitions().map((d) => d.variableId);
    assert.ok(ids.includes("highascg_pgm_1_remaining"));
    assert.ok(ids.includes("highascg_pgm_4_clip"));
    assert.ok(getVariables(stubInstance()).highascg_pgm_2_progress);
    assert.equal(
      pgmLayerVariableValues([live()]).highascg_pgm_1_progress,
      "65",
    );
  });
});

describe("WO-803 presets", () => {
  it("one per screen, the feedback only, no actions", () => {
    const added = [];
    addPgmReadbackPresets(stubInstance(), (section, key, p) =>
      added.push({ section, key, p }),
    );
    assert.deepEqual(
      added.map((a) => a.key),
      ["pgm_readback_screen_1", "pgm_readback_screen_2"],
    );
    assert.deepEqual(
      added.map((a) => a.p.name),
      ["PGM readback — Dioda", "PGM readback — S2"],
    );
    for (const [i, a] of added.entries()) {
      assert.equal(a.section, "pgm_readback");
      assert.deepEqual(a.p.feedbacks, [
        {
          feedbackId: PGM_READBACK_FEEDBACK_ID,
          options: { screen: String(i) },
        },
      ]);
      const actions = a.p.steps.flatMap((s) => [
        ...(s.down || []),
        ...(s.up || []),
      ]);
      assert.deepEqual(actions, [], "display only: no actions");
      assert.match(
        a.p.style.text,
        new RegExp(`highascg_screen_${i + 1}_label`),
      );
    }
  });

  it("the preset catalog has the section filled", () => {
    const { structure, presets } = getPresets(stubInstance());
    const sec = structure.find((s) => s.id === "pgm_readback");
    assert.equal(sec.name, "HighAsCG · PGM readback");
    assert.equal(sec.definitions.length, 2);
    assert.ok(sec.definitions.every((k) => presets[k]));
  });
});
