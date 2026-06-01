import assert from "node:assert/strict";
import { describe, it } from "node:test";

const modulePath = process.env.XHS_TOKEN_LINK_MODULE;
if (!modulePath) {
  throw new Error("XHS_TOKEN_LINK_MODULE is required");
}

const { buildXhsExploreUrl, parseXhsNoteLink } = await import(modulePath);

describe("xhs token link utilities", () => {
  it("parses note id and xsec token from an explore URL", () => {
    const result = parseXhsNoteLink(
      "https://www.xiaohongshu.com/explore/6a1d3c980000000007021dc1?xsec_token=ABC%3D&xsec_source=pc_creatormng",
    );

    assert.deepEqual(result, {
      noteId: "6a1d3c980000000007021dc1",
      workLink: "https://www.xiaohongshu.com/explore/6a1d3c980000000007021dc1?xsec_token=ABC%3D&xsec_source=pc_creatormng",
      xsecToken: "ABC=",
      xsecSource: "pc_creatormng",
      authorUserId: undefined,
    });
  });

  it("builds a creator-manager detail URL for a note id", () => {
    assert.equal(
      buildXhsExploreUrl("6a1d3c980000000007021dc1"),
      "https://www.xiaohongshu.com/explore/6a1d3c980000000007021dc1?xsec_source=pc_creatormng",
    );
  });
});
