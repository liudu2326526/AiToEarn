import assert from "node:assert/strict";
import { describe, it } from "node:test";

const modulePath = process.env.XHS_CLICK_POINT_MODULE;
if (!modulePath) {
  throw new Error("XHS_CLICK_POINT_MODULE is required");
}

const { getElementCenterPoint } = await import(modulePath);

describe("xhs click point utilities", () => {
  it("returns the center of a visible element rect", () => {
    assert.deepEqual(
      getElementCenterPoint({ left: 20, top: 40, width: 120, height: 80 }),
      { x: 80, y: 80 },
    );
  });

  it("returns undefined for empty rects", () => {
    assert.equal(getElementCenterPoint({ left: 20, top: 40, width: 0, height: 80 }), undefined);
  });
});
