/**
 * @file playlists.test.js
 * Playlist model, actions and presets — item-name variables, selected-playlist cursor, and the
 * live vs not-live transport split the web Playlists panel uses.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  itemName,
  playlistKey,
  playlistVariableDefinitions,
  playlistVariableId,
  playlistVariableValues,
  resolvePlaylist,
  selectedPlaylist,
  selectedPlaylistVariableId,
  sortPlaylists,
} from "../src/playlists.js";
import getPlaylistActions from "../src/actions/playlist-actions.js";
import getPlaylistFeedbacks from "../src/playlist-feedbacks.js";
import { addPlaylistPresets } from "../src/presets/playlist-presets.js";

const items = (...names) =>
  names.map((n) => ({ label: `projects/show/${n}`, value: n, type: "image" }));

/** "Zeta" is live on ch1 at item 2; "Alpha" is only defined in the project, start item 0. */
function fixture() {
  return [
    {
      live: true,
      channel: 1,
      previewChannel: null,
      sceneId: "zzzz-1111",
      sceneName: "Zeta",
      layerNumber: 11,
      loop: true,
      activeIndex: 2,
      startIndex: 0,
      items: items("a.PNG", "b.PNG", "c.PNG"),
    },
    {
      live: false,
      channel: null,
      previewChannel: null,
      sceneId: "aaaa-2222",
      sceneName: "Alpha",
      layerNumber: 3,
      loop: false,
      activeIndex: 0,
      startIndex: 0,
      items: [
        { label: "Opening title", value: "intro.mov" },
        ...items("x.mov"),
      ],
    },
  ];
}

function stubInstance() {
  const calls = [];
  const inst = {
    calls,
    logs: [],
    label: "hc",
    _playlists: sortPlaylists(fixture()),
    _selectedPlaylistKey: "",
    log(level, msg) {
      this.logs.push(`${level}: ${msg}`);
    },
    refreshPlaylists() {},
    selectPlaylist(key) {
      this._selectedPlaylistKey = key;
    },
    bridge: {
      api: {
        async playlistControl(body) {
          calls.push(body);
          return { ok: true };
        },
      },
    },
  };
  return inst;
}

describe("playlist model", () => {
  it("names file items by base name without extension, keeps custom labels", () => {
    assert.equal(
      itemName({
        label: "projects/airport/01Rajesh.PNG",
        value: "01Rajesh.PNG",
      }),
      "01Rajesh",
    );
    assert.equal(
      itemName({ label: "Dr. Smith", value: "smith.png" }),
      "Dr. Smith",
    );
    assert.equal(itemName(null), "");
  });

  it("sorts by look name so the order does not jump when a look goes live", () => {
    const sorted = sortPlaylists(fixture());
    assert.deepEqual(
      sorted.map((p) => p.sceneName),
      ["Alpha", "Zeta"],
    );
  });

  it("publishes current / next / prev item names, wrapping only when looping", () => {
    const list = sortPlaylists(fixture());
    const [alpha, zeta] = list;
    const vars = playlistVariableValues(list, zeta);
    assert.equal(vars[playlistVariableId(zeta, "item")], "c");
    assert.equal(vars[playlistVariableId(zeta, "next_item")], "a"); // loops
    assert.equal(vars[playlistVariableId(zeta, "position")], "3/3");
    assert.equal(vars[playlistVariableId(zeta, "state")], "live");
    assert.equal(vars[playlistVariableId(alpha, "item")], "Opening title");
    assert.equal(vars[playlistVariableId(alpha, "prev_item")], ""); // no loop
    assert.equal(vars[playlistVariableId(alpha, "item_2")], "x");
    assert.equal(vars[selectedPlaylistVariableId("item")], "c");
  });

  it("defines every published variable", () => {
    const list = sortPlaylists(fixture());
    const defined = new Set(
      playlistVariableDefinitions(list).map((d) => d.variableId),
    );
    for (const id of Object.keys(playlistVariableValues(list, list[0]))) {
      assert.ok(defined.has(id), `undefined variable ${id}`);
    }
  });

  it("selected playlist: explicit pick, else first live, else first", () => {
    const inst = stubInstance();
    assert.equal(selectedPlaylist(inst).sceneName, "Zeta");
    inst._selectedPlaylistKey = "aaaa-2222:3";
    assert.equal(selectedPlaylist(inst).sceneName, "Alpha");
    assert.equal(resolvePlaylist(inst, "").sceneName, "Alpha");
    assert.equal(resolvePlaylist(inst, "zzzz-1111:11").sceneName, "Zeta");
    inst._selectedPlaylistKey = "gone:1";
    assert.equal(selectedPlaylist(inst).sceneName, "Zeta");
  });
});

describe("playlist actions", () => {
  it("live playlist: next / goto go to the program channel", async () => {
    const inst = stubInstance();
    const a = getPlaylistActions(inst);
    await a.playlist_next.callback({ options: { playlist: "zzzz-1111:11" } });
    await a.playlist_goto.callback({
      options: { playlist: "zzzz-1111:11", item: 2 },
    });
    assert.deepEqual(inst.calls, [
      { channel: 1, layerNumber: 11, action: "next" },
      { channel: 1, layerNumber: 11, action: "goto", index: 1 },
    ]);
  });

  it("not-live playlist: prev / goto move the start item", async () => {
    const inst = stubInstance();
    const a = getPlaylistActions(inst);
    await a.playlist_prev.callback({ options: { playlist: "aaaa-2222:3" } });
    await a.playlist_goto.callback({
      options: { playlist: "aaaa-2222:3", item: 2 },
    });
    assert.deepEqual(inst.calls, [
      {
        action: "step_preview",
        sceneId: "aaaa-2222",
        layerNumber: 3,
        direction: "prev",
      },
      { action: "set_start", sceneId: "aaaa-2222", layerNumber: 3, index: 1 },
    ]);
  });

  it("empty playlist option follows the Companion selection", async () => {
    const inst = stubInstance();
    const a = getPlaylistActions(inst);
    await a.playlist_select_step.callback({ options: { direction: "next" } });
    // Zeta (first live) was implicitly selected; next wraps to Alpha.
    assert.equal(inst._selectedPlaylistKey, "aaaa-2222:3");
    await a.playlist_next.callback({ options: { playlist: "" } });
    assert.equal(inst.calls[0].sceneId, "aaaa-2222");
  });

  it("goto out of range sends nothing", async () => {
    const inst = stubInstance();
    await getPlaylistActions(inst).playlist_goto.callback({
      options: { playlist: "zzzz-1111:11", item: 9 },
    });
    assert.equal(inst.calls.length, 0);
    assert.match(inst.logs[0], /out of range/);
  });

  it("restage refuses a not-live playlist", async () => {
    const inst = stubInstance();
    await getPlaylistActions(inst).playlist_restage.callback({
      options: { playlist: "aaaa-2222:3" },
    });
    assert.equal(inst.calls.length, 0);
  });
});

describe("playlist feedbacks + presets", () => {
  it("item-active tracks the current index", () => {
    const inst = stubInstance();
    const fb = getPlaylistFeedbacks(inst).playlist_item_active;
    assert.equal(
      fb.callback({ options: { playlist: "zzzz-1111:11", item: 3 } }),
      true,
    );
    assert.equal(
      fb.callback({ options: { playlist: "zzzz-1111:11", item: 1 } }),
      false,
    );
  });

  it("builds a selected row plus one section per playlist, captions from variables", () => {
    const inst = stubInstance();
    const presets = {};
    const structure = [{ id: "playlists", name: "Playlists", definitions: [] }];
    const add = (sectionId, key, preset) => {
      presets[key] = preset;
      structure.find((s) => s.id === sectionId).definitions.push(key);
    };
    addPlaylistPresets(inst, structure, add);
    assert.equal(structure.length, 3);
    const zeta = inst._playlists.find((p) => p.sceneName === "Zeta");
    const current = presets.playlist_zzzz1111_l11_current;
    assert.ok(
      current.style.text.includes(`$(hc:${playlistVariableId(zeta, "item")})`),
    );
    assert.ok(presets.playlist_sel_next.style.text.includes("sel_next_item"));
    assert.equal(
      presets.playlist_zzzz1111_l11_item_2.steps[0].down[0].options.playlist,
      playlistKey(zeta),
    );
    // No literal item names baked into captions.
    for (const p of Object.values(presets)) {
      assert.ok(!/\bb\.PNG|\bOpening title/.test(p.style.text));
    }
  });
});
