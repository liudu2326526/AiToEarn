import type { PlasmoCSConfig } from "plasmo";

export const config: PlasmoCSConfig = {
  matches: ["*://creator.xiaohongshu.com/*"],
  run_at: "document_start",
  world: "MAIN",
};

// Hook attachShadow to force closed shadow roots to open,
// so our automation scripts can access internal buttons.
const originalAttachShadow = Element.prototype.attachShadow;
Element.prototype.attachShadow = function (init: ShadowRootInit) {
  return originalAttachShadow.call(this, { ...init, mode: "open" });
};
