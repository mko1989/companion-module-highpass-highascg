/**
 * @file audio-only-look.test.js
 * WO-572 (HighAsCG) — Companion-side support for audio-only looks: a separate live map
 * (scene.liveAudioOnly / instance._sceneLiveAudioOnly) from the video look's scene.live, since a
 * screen can have one live video look and one live audio-only look at the same time.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { resolveAudioOnlyLookAirState } from "../src/look-air-state.js";
import { LOOK_AIR_FEEDBACKS } from "../src/look-feedback-ids.js";

function fakeInstance({ programChannels, previewChannels, live }) {
  return {
    _channelMap: { programChannels, previewChannels },
    _sceneLiveAudioOnly: live || {},
  };
}

describe("resolveAudioOnlyLookAirState", () => {
  it("reports onPgm when the audio-only look id matches the PGM channel entry", () => {
    const instance = fakeInstance({
      programChannels: [1],
      previewChannels: [2],
      live: { 1: { sceneId: "a1" } },
    });
    assert.deepEqual(resolveAudioOnlyLookAirState(instance, "a1", 0), {
      onPgm: true,
      onPrv: false,
    });
  });

  it("reports onPrv when staged on the preview channel only", () => {
    const instance = fakeInstance({
      programChannels: [1],
      previewChannels: [2],
      live: { 2: { sceneId: "a1" } },
    });
    assert.deepEqual(resolveAudioOnlyLookAirState(instance, "a1", 0), {
      onPgm: false,
      onPrv: true,
    });
  });

  it("PGM wins when the same audio-only look id is (impossibly) in both slots", () => {
    const instance = fakeInstance({
      programChannels: [1],
      previewChannels: [2],
      live: { 1: { sceneId: "a1" }, 2: { sceneId: "a1" } },
    });
    assert.deepEqual(resolveAudioOnlyLookAirState(instance, "a1", 0), {
      onPgm: true,
      onPrv: false,
    });
  });

  it("no entry for this screen -> both false, never throws on missing channel map", () => {
    assert.deepEqual(resolveAudioOnlyLookAirState({}, "a1", 0), {
      onPgm: false,
      onPrv: false,
    });
  });

  it("empty/blank look id always resolves false without touching state", () => {
    const instance = fakeInstance({
      programChannels: [1],
      previewChannels: [2],
      live: { 1: { sceneId: "a1" } },
    });
    assert.deepEqual(resolveAudioOnlyLookAirState(instance, "", 0), {
      onPgm: false,
      onPrv: false,
    });
  });

  it("PGM-only screen (no separate PRV channel) never reports onPrv", () => {
    const instance = fakeInstance({
      programChannels: [1],
      previewChannels: [null],
      live: { 1: { sceneId: "a1" } },
    });
    assert.deepEqual(resolveAudioOnlyLookAirState(instance, "a1", 0), {
      onPgm: true,
      onPrv: false,
    });
  });
});

describe("LOOK_AIR_FEEDBACKS", () => {
  it("includes the audio-only feedback ids so state-sync's refresh call re-evaluates them", () => {
    assert.ok(LOOK_AIR_FEEDBACKS.includes("look_audio_only_is_live"));
    assert.ok(LOOK_AIR_FEEDBACKS.includes("look_audio_only_is_preview"));
  });
});
