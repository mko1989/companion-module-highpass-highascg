/**
 * @file presets-and-config.test.js
 * WO-384 — four things the owner hit on 2026-07-29:
 *   "i cant save the config of the module, because i have nothing in the backup ip"
 *   "the looks presets use variable for the look, but not for the screen label"
 *   "the looks presets are set with undefined bus instead of pgm"
 *   "the timer doesnt have preset buttons"
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import getConfigFields from "../src/config-fields.js";
import getPresets from "../src/presets.js";
import getActions from "../src/actions/index.js";
import {
  screenDisplayLabel,
  screenLabelVariableDefinitions,
  screenLabelVariableId,
} from "../src/look-vars.js";
import getVariables from "../src/variables.js";

/** Minimal instance the preset/variable builders accept. */
function stubInstance() {
  return {
    label: "highascg",
    config: { highascg_enabled: true },
    _presetLooks: [
      { id: "look-a", name: "Opening", mainScope: "0" },
      { id: "look-b", name: "Everywhere", mainScope: "all" },
      { id: "look-c", name: "Second screen", mainScope: "1" },
    ],
    _lookSlots: { 1: "look-a" },
    _channelMap: {
      screenCount: 2,
      screenLabels: ["Stage", ""],
      programChannels: [1, 3],
    },
    _screenTimers: [
      {
        timerId: "5c12cb77-aaaa",
        name: "Timer S2",
        config: { mode: "duration", durationSec: 600 },
        screens: { 1: { channel: 3, layer: 980, visible: true } },
      },
    ],
    getLookIdForSlot(slot) {
      return this._lookSlots[String(slot)] || "";
    },
    setVariableValues() {},
    log() {},
  };
}

/** Companion config regexes are strings in `/…/` form — this is how Companion itself reads them. */
function asRegExp(companionRegex) {
  assert.equal(
    typeof companionRegex,
    "string",
    "Companion regex fields are strings",
  );
  const m = /^\/(.*)\/([a-z]*)$/s.exec(companionRegex);
  assert.ok(m, `not a /…/ regex string: ${companionRegex}`);
  return new RegExp(m[1], m[2]);
}

describe("config fields", () => {
  it("accepts an empty backup host so the config saves without hot backup", () => {
    const backup = getConfigFields().find((f) => f.id === "backup_host");
    assert.ok(backup, "backup_host field missing");
    const re = asRegExp(backup.regex);
    assert.equal(
      re.test(""),
      true,
      "empty must be valid — the field is optional",
    );
    assert.equal(re.test("192.168.1.50"), true, "a real IP must still pass");
    assert.equal(
      re.test("not-an-ip"),
      false,
      "a wrong value must still be rejected",
    );
    assert.equal(re.test("999.1.1.1"), false);
  });

  it("the main box host is still a required IP with a usable default", () => {
    const main = getConfigFields().find((f) => f.id === "box_host");
    assert.equal(main.default, "127.0.0.1");
    const re = asRegExp(main.regex);
    assert.equal(re.test("127.0.0.1"), true);
    assert.equal(re.test(""), false, "the main host is not optional");
  });
});

describe("look presets", () => {
  const { presets } = (() => {
    const instance = stubInstance();
    const { structure, presets } = getPresets(instance);
    return { structure, presets, instance };
  })();

  const lookPresets = Object.entries(presets).filter(([, p]) =>
    (p.steps || []).some((s) =>
      [...(s.down || []), ...(s.up || [])].some(
        (a) => a.actionId === "look_take",
      ),
    ),
  );

  it("every look_take preset names its bus explicitly", () => {
    assert.ok(lookPresets.length >= 3, "expected look presets to exist");
    for (const [key, preset] of lookPresets) {
      for (const step of preset.steps) {
        for (const act of [...(step.down || []), ...(step.up || [])]) {
          if (act.actionId !== "look_take") continue;
          assert.notEqual(
            act.options.target,
            undefined,
            `${key}: look_take must carry a bus, or the button shows "undefined"`,
          );
          assert.ok(
            ["program", "preview"].includes(act.options.target),
            `${key}: unexpected bus ${act.options.target}`,
          );
        }
      }
    }
  });

  it("the bus the action declares is one the action actually offers", () => {
    const target = getActions(stubInstance()).look_take.options.find(
      (o) => o.id === "target",
    );
    const offered = target.choices.map((c) => c.id);
    assert.deepEqual(offered, ["program", "preview"]);
    assert.equal(target.default, "program");
  });

  it("screen-scoped look captions read the screen name from a variable", () => {
    const screenScoped = presets["look_look-a"];
    assert.ok(screenScoped, "expected a preset for the screen-scoped look");
    assert.match(screenScoped.style.text, /highascg_look_label_look-a/);
    assert.match(
      screenScoped.style.text,
      new RegExp(screenLabelVariableId(0)),
      "the screen half must be a variable, not a baked-in label",
    );
    assert.doesNotMatch(screenScoped.style.text, /Scr 1/);
  });

  it("looks scoped to every screen stay captioned 'All'", () => {
    const allScoped = presets["look_look-b"];
    assert.ok(allScoped);
    assert.match(allScoped.style.text, /\\nAll$/);
    assert.doesNotMatch(allScoped.style.text, /highascg_screen_/);
  });
});

describe("screen label variables", () => {
  it("declares one per screen and prefers the operator's custom name", () => {
    const defs = screenLabelVariableDefinitions();
    assert.equal(defs[0].variableId, "highascg_screen_1_label");
    assert.equal(defs.length, 4);

    const map = { screenLabels: ["Stage", ""] };
    assert.equal(screenDisplayLabel(map, 0), "Stage");
    assert.equal(screenDisplayLabel(map, 1), "S2", "blank falls back to S<n>");
    assert.equal(screenDisplayLabel(null, 2), "S3");
  });

  it("are registered with Companion", () => {
    const vars = getVariables(stubInstance());
    assert.ok("highascg_screen_1_label" in vars);
    assert.ok("highascg_screen_4_label" in vars);
  });
});

describe("screen timer presets", () => {
  const instance = stubInstance();
  const { structure, presets } = getPresets(instance);

  it("has its own section", () => {
    const section = structure.find((s) => s.id === "screen_timers");
    assert.ok(section, "screen_timers section missing");
    assert.match(section.name, /Screen timers/);
  });

  it("builds one button set per timer that exists — no placeholder slots", () => {
    const keys = Object.keys(presets).filter((k) =>
      k.startsWith("screen_timer_"),
    );
    // The one live timer in the stub, keyed by its id — not by an index.
    assert.ok(keys.includes("screen_timer_5c12cb77_display"));
    assert.ok(keys.includes("screen_timer_5c12cb77_start_pause"));
    assert.ok(keys.includes("screen_timer_5c12cb77_reset"));
    assert.ok(keys.includes("screen_timer_5c12cb77_visible"));
    assert.ok(keys.includes("screen_timer_5c12cb77_set_time"));
    // Owner: "no place holders" — nothing for timers that do not exist.
    assert.equal(keys.filter((k) => /^screen_timer_\d+_/.test(k)).length, 0);
    assert.equal(keys.filter((k) => k.includes("slot")).length, 0);
    // Choose-the-timer buttons remain so a page can be built before the show.
    assert.ok(keys.includes("screen_timer_pick_set_time") === false);
    assert.ok(keys.includes("screen_timer_pick_start"));
    assert.ok(keys.includes("screen_timer_pick_add_minute"));
  });

  it("with no timers configured, only the choose-the-timer buttons exist", () => {
    const bare = stubInstance();
    bare._screenTimers = [];
    const { presets: p2 } = getPresets(bare);
    const keys = Object.keys(p2).filter((k) => k.startsWith("screen_timer_"));
    assert.ok(keys.length > 0, "the section must not vanish");
    assert.ok(keys.every((k) => k.startsWith("screen_timer_pick_")));
  });

  it("captions read that timer's variables so they tick and follow renames", () => {
    const display = presets.screen_timer_5c12cb77_display;
    assert.match(display.style.text, /highascg_timer_5c12cb77_name/);
    assert.match(display.style.text, /highascg_timer_5c12cb77_time_short/);
    assert.match(
      presets.screen_timer_5c12cb77_start_pause.style.text,
      /highascg_timer_5c12cb77_time_short/,
    );
  });

  it("buttons carry the timer id, and a variable is never stuffed into a dropdown", () => {
    const act = presets.screen_timer_5c12cb77_start_pause.steps[0].down[0];
    assert.equal(act.actionId, "screen_timer_start_pause");
    assert.equal(act.options.timer, "5c12cb77-aaaa");
    assert.doesNotMatch(
      String(act.options.timer),
      /\$\(/,
      "a dropdown cannot resolve a variable",
    );

    const vis = presets.screen_timer_5c12cb77_visible.steps[0].down[0];
    assert.equal(vis.options.timer, "5c12cb77-aaaa");
    assert.equal(
      vis.options.fadeFrames,
      25,
      "the eye fades, matching the web UI",
    );
  });

  it("every preset action id is a real action", () => {
    const actionIds = new Set(Object.keys(getActions(stubInstance())));
    for (const [key, preset] of Object.entries(presets)) {
      for (const step of preset.steps || []) {
        for (const act of [...(step.down || []), ...(step.up || [])]) {
          assert.ok(
            actionIds.has(act.actionId),
            `${key} references unknown action ${act.actionId}`,
          );
        }
      }
    }
  });
});
