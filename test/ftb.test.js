/**
 * @file ftb.test.js
 * Fade to black — per-screen and all-screens actions (POST /api/ftb) and their presets.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import getFtbActions, {
  buildScreenDropdown,
} from "../src/actions/ftb-actions.js";
import { addFtbPresets } from "../src/presets/ftb-presets.js";

function stubInstance(
  channelMap = { screenCount: 2, screenLabels: ["Main", ""] },
) {
  const calls = [];
  return {
    calls,
    logs: [],
    label: "hc",
    _channelMap: channelMap,
    log(level, msg) {
      this.logs.push(`${level}: ${msg}`);
    },
    bridge: {
      api: {
        async fadeToBlack(body) {
          calls.push(body);
          return { ok: true };
        },
      },
    },
  };
}

describe("fade to black", () => {
  it("screen dropdown lists every screen with its HighAsCG name", () => {
    const { choices } = buildScreenDropdown(stubInstance());
    assert.deepEqual(choices, [
      { id: "0", label: "Screen 1 · Main" },
      { id: "1", label: "Screen 2" },
    ]);
  });

  it("per screen sends screenIdx; all screens omits it", async () => {
    const inst = stubInstance();
    const a = getFtbActions(inst);
    await a.ftb_screen.callback({
      options: { screen: "1", durationFrames: 50, tween: "easeinsine" },
    });
    await a.ftb_all.callback({
      options: { durationFrames: 25, tween: "linear" },
    });
    assert.deepEqual(inst.calls, [
      { screenIdx: 1, durationFrames: 50, tween: "easeinsine" },
      { durationFrames: 25, tween: "linear" },
    ]);
  });

  it("clamps the fade to the server's 1-120 frames", async () => {
    const inst = stubInstance();
    await getFtbActions(inst).ftb_all.callback({
      options: { durationFrames: 500 },
    });
    assert.equal(inst.calls[0].durationFrames, 120);
  });

  it("presets: FTB ALL plus one per screen, captioned by the screen-label variable", () => {
    const presets = {};
    const add = (_s, key, p) => {
      presets[key] = p;
    };
    addFtbPresets(stubInstance(), add);
    assert.deepEqual(Object.keys(presets), [
      "ftb_all",
      "ftb_screen_1",
      "ftb_screen_2",
    ]);
    assert.equal(
      presets.ftb_screen_2.style.text,
      "FTB\\n$(hc:highascg_screen_2_label)",
    );
    assert.equal(presets.ftb_screen_2.steps[0].down[0].options.screen, "1");
    assert.equal(presets.ftb_all.steps[0].down[0].actionId, "ftb_all");
  });
});
