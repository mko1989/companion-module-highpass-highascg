/**
 * @file screen-timers.test.js
 * Screen-timer model + actions (HighAsCG WO-381 — "full timer control and display as variable").
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildScreenTimerDropdown,
  computeDisplaySeconds,
  formatTimerClock,
  formatTimerShort,
  parseTimeText,
  resolveTimer,
  screenTimerVariableDefinitions,
  screenTimerVariableValues,
  secondsToClockText,
  sortTimers,
  timerIsVisible,
  timerRunState,
  timerVariableId,
  TIMER_VARIABLE_FIELDS,
} from "../src/screen-timers.js";
import getScreenTimerActions from "../src/actions/screen-timer-actions.js";

const NOW = Date.parse("2026-07-29T12:00:00Z");

/** Two timers: A ready on screen 1, B running (65s in) and on air on screen 2. */
function fixture() {
  return [
    {
      timerId: "id-b",
      name: "B",
      config: { mode: "duration", durationSec: 300 },
      lastCmd: "start",
      cmdAt: NOW - 65_000,
      screens: { 1: { channel: 3, layer: 980, visible: true } },
    },
    {
      timerId: "id-a",
      name: "A",
      config: { mode: "duration", durationSec: 600 },
      lastCmd: null,
      screens: { 0: { channel: 1, layer: 980, visible: false } },
    },
  ];
}

/** Instance stub that records every API call the actions make. */
function stubInstance(timers = fixture()) {
  const calls = [];
  return {
    calls,
    logs: [],
    _screenTimers: sortTimers(timers),
    log(level, msg) {
      this.logs.push(`${level}: ${msg}`);
    },
    updateActions() {},
    refreshScreenTimers() {
      calls.push({ fn: "refresh" });
    },
    async parseVariablesInString(s) {
      return s;
    },
    bridge: {
      api: {
        async screenTimerCmd(timerId, cmd) {
          calls.push({ fn: "cmd", timerId, cmd });
          return { ok: true };
        },
        async screenTimerAssign(body) {
          calls.push({ fn: "assign", ...body });
          return { ok: true };
        },
        async screenTimerVisible(body) {
          calls.push({ fn: "visible", ...body });
          return { ok: true };
        },
      },
    },
  };
}

describe("screen-timer model", () => {
  it("orders timers by screen then layer so variable slots stay put", () => {
    assert.deepEqual(
      sortTimers(fixture()).map((t) => t.name),
      ["A", "B"],
    );
  });

  it("computes the display time from lastCmd/cmdAt without asking the server", () => {
    const [b, a] = fixture();
    assert.equal(computeDisplaySeconds(b, NOW), 235); // 300 - 65 elapsed
    assert.equal(computeDisplaySeconds(a, NOW), 600); // never started
    assert.equal(
      computeDisplaySeconds({ ...b, lastCmd: "pause", remainingSec: 42 }, NOW),
      42, // paused shows the frozen remainder, not the full duration
    );
    // Runs past zero into negative rather than sticking at 0.
    assert.equal(
      computeDisplaySeconds({ ...b, cmdAt: NOW - 310_000 }, NOW),
      -10,
    );
  });

  it("formats negative and long times", () => {
    assert.equal(formatTimerClock(235), "00:03:55");
    assert.equal(formatTimerClock(-7), "-00:00:07");
    assert.equal(formatTimerShort(235), "03:55");
    assert.equal(formatTimerShort(3725), "01:02:05");
  });

  it("parses the time formats an operator would type", () => {
    assert.equal(parseTimeText("90"), 90);
    assert.equal(parseTimeText("5:00"), 300);
    assert.equal(parseTimeText("01:30:00"), 5400);
    assert.equal(parseTimeText(" 90:00 "), 5400); // minutes not clamped to 59
    assert.equal(parseTimeText(""), null);
    assert.equal(parseTimeText("abc"), null);
    assert.equal(parseTimeText("1:2:3:4"), null);
    assert.equal(secondsToClockText(5400), "01:30:00");
  });

  it("reports run state and on-air state", () => {
    const [b, a] = fixture();
    assert.equal(timerRunState(b), "running");
    assert.equal(timerRunState(a), "ready");
    assert.equal(timerRunState({ lastCmd: "pause" }), "paused");
    assert.equal(timerIsVisible(b), true);
    assert.equal(timerIsVisible(a), false);
  });

  it("publishes one variable block per timer that exists — and nothing for timers that do not", () => {
    const defs = screenTimerVariableDefinitions(fixture());
    assert.equal(
      defs.filter((d) => d.variableId === "highascg_timer_count").length,
      1,
    );
    // Exactly two timers → two blocks, no placeholders (owner: "no place holders").
    assert.equal(defs.length, 1 + 2 * TIMER_VARIABLE_FIELDS.length);
    assert.deepEqual(
      screenTimerVariableDefinitions([]).map((d) => d.variableId),
      ["highascg_timer_count"],
    );
    // The definition NAME carries the human name so the picker is readable.
    const nameDef = defs.find(
      (d) => d.variableId === timerVariableId("id-a", "name"),
    );
    assert.match(nameDef.name, /Timer "A"/);

    const v = screenTimerVariableValues(fixture(), NOW);
    assert.equal(v.highascg_timer_count, 2);
    assert.equal(v[timerVariableId("id-a", "name")], "A");
    assert.equal(v[timerVariableId("id-a", "time")], "00:10:00");
    assert.equal(v[timerVariableId("id-a", "state")], "ready");
    assert.equal(v[timerVariableId("id-a", "visible")], "false");
    assert.equal(v[timerVariableId("id-a", "screens")], "1"); // 1-based for the operator
    assert.equal(v[timerVariableId("id-b", "time")], "00:03:55");
    assert.equal(v[timerVariableId("id-b", "time_short")], "03:55");
    assert.equal(v[timerVariableId("id-b", "seconds")], 235);
    assert.equal(v[timerVariableId("id-b", "state")], "running");
    assert.equal(v[timerVariableId("id-b", "visible")], "true");
    assert.equal(v[timerVariableId("id-b", "id")], "id-b");
    // Every declared variable gets a value, and no value is published without a definition.
    const declared = new Set(defs.map((d) => d.variableId));
    for (const id of declared) assert.ok(id in v, `${id} missing from values`);
    for (const id of Object.keys(v))
      assert.ok(declared.has(id), `${id} published with no definition`);
  });

  it("variable ids are derived from the timer id, not its position", () => {
    assert.equal(
      timerVariableId("5c12cb77-8d56-4341", "time"),
      "highascg_timer_5c12cb77_time",
    );
    assert.equal(
      timerVariableId({ timerId: "id-a" }, "name"),
      "highascg_timer_ida_name",
    );
    // Reordering the list must not move a timer's variables.
    const [b, a] = fixture();
    const forward = screenTimerVariableValues([a, b], NOW);
    const reversed = screenTimerVariableValues([b, a], NOW);
    assert.deepEqual(forward, reversed);
  });

  it("a clock-mode timer counts to its target time of day", () => {
    const at = Date.parse("2026-07-29T12:00:00"); // local midnight-relative maths
    const t = {
      config: { mode: "clock", targetTime: "12:01:40" },
      screens: {},
    };
    assert.equal(computeDisplaySeconds(t, at), 100);
    const v = screenTimerVariableValues([{ ...t, timerId: "id-clock" }], at);
    assert.equal(v[timerVariableId("id-clock", "mode")], "clock");
    assert.equal(v[timerVariableId("id-clock", "duration")], "12:01:40");
  });
});

describe("screen-timer actions", () => {
  it("dropdown offers the first-timer default plus exactly the timers that exist", () => {
    const dd = buildScreenTimerDropdown(stubInstance());
    assert.equal(dd.default, "");
    assert.equal(dd.choices[0].id, "");
    assert.deepEqual(
      dd.choices.slice(1).map((c) => c.id),
      ["id-a", "id-b"],
    );
    assert.match(dd.choices[1].label, /A · screen 1/);
    // No placeholder rows for timers that do not exist.
    assert.equal(dd.choices.filter((c) => /slot/i.test(c.label)).length, 0);
    assert.deepEqual(
      buildScreenTimerDropdown({ _screenTimers: [] }).choices.map((c) => c.id),
      [""],
    );
  });

  it("resolves an empty option to the first timer, and an id to that timer", () => {
    const inst = stubInstance();
    assert.equal(resolveTimer(inst, "").timerId, "id-a");
    assert.equal(resolveTimer(inst, "id-b").timerId, "id-b");
    assert.equal(resolveTimer(inst, "gone"), null);
    assert.equal(resolveTimer({ _screenTimers: [] }, ""), null);
  });

  it("an id-bound action drives exactly that timer", async () => {
    const inst = stubInstance();
    await getScreenTimerActions(inst).screen_timer_reset.callback({
      options: { timer: "id-b" },
    });
    assert.deepEqual(inst.calls[0], {
      fn: "cmd",
      timerId: "id-b",
      cmd: "reset",
    });
  });

  it("transport posts one cmd — the server fans it out", async () => {
    const inst = stubInstance();
    const actions = getScreenTimerActions(inst);
    await actions.screen_timer_start.callback({ options: { timer: "id-b" } });
    assert.deepEqual(inst.calls[0], {
      fn: "cmd",
      timerId: "id-b",
      cmd: "start",
    });
  });

  it("start/pause toggles off the timer's own run state", async () => {
    const inst = stubInstance();
    const actions = getScreenTimerActions(inst);
    await actions.screen_timer_start_pause.callback({
      options: { timer: "id-b" },
    }); // running
    assert.equal(inst.calls[0].cmd, "pause");
    inst.calls.length = 0;
    await actions.screen_timer_start_pause.callback({
      options: { timer: "id-a" },
    }); // ready
    assert.equal(inst.calls[0].cmd, "start");
  });

  it("set time writes the parsed duration to every assigned screen", async () => {
    const inst = stubInstance([
      {
        timerId: "id-m",
        name: "M",
        config: { mode: "duration", durationSec: 300, position: "center" },
        screens: {
          0: { channel: 1, layer: 980 },
          2: { channel: 5, layer: 981 },
        },
      },
    ]);
    const actions = getScreenTimerActions(inst);
    await actions.screen_timer_set_time.callback({
      options: { timer: "id-m", time: "1:30" },
    });
    const assigns = inst.calls.filter((c) => c.fn === "assign");
    assert.deepEqual(
      assigns.map((a) => a.screenIdx),
      [0, 2],
    );
    assert.equal(assigns[0].config.durationSec, 90);
    assert.equal(assigns[0].config.position, "center"); // merged, not replaced
  });

  it("set time on a clock timer writes targetTime instead", async () => {
    const inst = stubInstance([
      {
        timerId: "id-c",
        config: { mode: "clock", targetTime: "18:00:00" },
        screens: { 0: { channel: 1, layer: 980 } },
      },
    ]);
    await getScreenTimerActions(inst).screen_timer_set_time.callback({
      options: { timer: "id-c", time: "20:30:00" },
    });
    const assign = inst.calls.find((c) => c.fn === "assign");
    assert.equal(assign.config.targetTime, "20:30:00");
    assert.equal("durationSec" in assign.config, false);
  });

  it("unparseable time is refused, not sent as 0", async () => {
    const inst = stubInstance();
    await getScreenTimerActions(inst).screen_timer_set_time.callback({
      options: { timer: "id-a", time: "banana" },
    });
    assert.equal(inst.calls.filter((c) => c.fn === "assign").length, 0);
    assert.match(inst.logs.join("\n"), /cannot parse/);
  });

  it("adjust adds and subtracts, never below zero, and refuses clock timers", async () => {
    const inst = stubInstance();
    const actions = getScreenTimerActions(inst);
    await actions.screen_timer_adjust_time.callback({
      options: { timer: "id-a", delta: 60 },
    });
    assert.equal(
      inst.calls.find((c) => c.fn === "assign").config.durationSec,
      660,
    );
    inst.calls.length = 0;
    await actions.screen_timer_adjust_time.callback({
      options: { timer: "id-a", delta: -900 },
    });
    assert.equal(
      inst.calls.find((c) => c.fn === "assign").config.durationSec,
      0,
    );

    const clock = stubInstance([
      {
        timerId: "id-c",
        config: { mode: "clock", targetTime: "18:00:00" },
        screens: { 0: { channel: 1, layer: 980 } },
      },
    ]);
    await getScreenTimerActions(clock).screen_timer_adjust_time.callback({
      options: { timer: "id-c", delta: 60 },
    });
    assert.equal(clock.calls.filter((c) => c.fn === "assign").length, 0);
  });

  it("show/hide toggles per screen and fades by default", async () => {
    const inst = stubInstance();
    const actions = getScreenTimerActions(inst);
    await actions.screen_timer_visible.callback({
      options: { timer: "id-b", screen: "", mode: "toggle", fadeFrames: 25 },
    });
    assert.deepEqual(inst.calls[0], {
      fn: "visible",
      timerId: "id-b",
      screenIdx: 1,
      visible: false, // it was visible → toggled off
      fadeFrames: 25,
    });

    inst.calls.length = 0;
    await actions.screen_timer_visible.callback({
      options: { timer: "id-b", screen: "", mode: "show", fadeFrames: 0 },
    });
    assert.equal(inst.calls[0].visible, true);
    assert.equal(
      "fadeFrames" in inst.calls[0],
      false,
      "0 frames must mean a cut, not fadeFrames: 0",
    );
  });

  it("show/hide on a screen the timer is not on does nothing", async () => {
    const inst = stubInstance();
    await getScreenTimerActions(inst).screen_timer_visible.callback({
      options: { timer: "id-b", screen: "3", mode: "show", fadeFrames: 25 },
    });
    assert.equal(inst.calls.filter((c) => c.fn === "visible").length, 0);
    assert.match(inst.logs.join("\n"), /not on that screen/);
  });

  it("actions no-op (and say so) when no timer exists", async () => {
    const inst = stubInstance([]);
    const actions = getScreenTimerActions(inst);
    await actions.screen_timer_start.callback({ options: { timer: "" } });
    assert.equal(inst.calls.length, 0);
    assert.match(inst.logs.join("\n"), /no timer available/);
  });
});
