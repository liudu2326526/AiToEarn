import assert from "node:assert/strict";
import { describe, it } from "node:test";

const modulePath = process.env.XHS_NOTE_MANAGER_TAB_MODULE;
if (!modulePath) {
  throw new Error("XHS_NOTE_MANAGER_TAB_MODULE is required");
}

const { selectBestXhsNoteManagerTab } = await import(modulePath);

describe("xhs note manager tab utilities", () => {
  it("prefers the latest new note-manager tab over older duplicates", () => {
    const best = selectBestXhsNoteManagerTab([
      {
        id: 11,
        url: "https://creator.xiaohongshu.com/new/note-manager",
        active: false,
        lastAccessed: 100,
      },
      {
        id: 22,
        url: "https://creator.xiaohongshu.com/new/note-manager",
        active: false,
        lastAccessed: 300,
      },
    ]);

    assert.equal(best?.id, 22);
  });

  it("prefers grouped MultiPost tabs when timestamps are similar", () => {
    const best = selectBestXhsNoteManagerTab([
      {
        id: 31,
        url: "https://creator.xiaohongshu.com/new/note-manager",
        groupId: -1,
        lastAccessed: 300,
      },
      {
        id: 32,
        url: "https://creator.xiaohongshu.com/new/note-manager",
        groupId: 8,
        lastAccessed: 300,
      },
    ]);

    assert.equal(best?.id, 32);
  });
});
