import assert from "node:assert/strict";
import { describe, it } from "node:test";

const modulePath = process.env.TRUSTED_ORIGIN_MODULE;
if (!modulePath) {
  throw new Error("TRUSTED_ORIGIN_MODULE is required");
}

const { isTrustedOrigin } = await import(modulePath);

describe("trusted origin utilities", () => {
  it("trusts local development hosts without stored authorization", () => {
    assert.equal(isTrustedOrigin("127.0.0.1", []), true);
    assert.equal(isTrustedOrigin("localhost", []), true);
    assert.equal(isTrustedOrigin("::1", []), true);
  });

  it("trusts the AitoBee production host without stored authorization", () => {
    assert.equal(isTrustedOrigin("aitobee.muskapis.com", []), true);
  });

  it("still rejects unknown remote hosts unless explicitly trusted", () => {
    assert.equal(isTrustedOrigin("example.com", []), false);
    assert.equal(isTrustedOrigin("app.example.com", [{ domain: "*.example.com" }]), true);
    assert.equal(isTrustedOrigin("multipost.app", [{ domain: "multipost.app" }]), true);
  });
});
