import { describe, expect, it } from "vitest";
import { isSharedWith } from "../src/lib/plans";

describe("isSharedWith", () => {
  const sharing = [
    { type: "user", emailAddress: "Coach@Gmail.com" },
    { type: "user", emailAddress: "ana.test@gmail.com" },
    { type: "domain", domain: "box.com.ar" },
  ];

  it("matches a user permission ignoring case and spaces", () => {
    expect(isSharedWith(sharing, " Ana.Test@Gmail.com ")).toBe(true);
  });

  it("matches everyone in a shared domain", () => {
    expect(isSharedWith(sharing, "someone@box.com.ar")).toBe(true);
  });

  it("rejects emails the file is not shared with", () => {
    expect(isSharedWith(sharing, "other@gmail.com")).toBe(false);
    expect(isSharedWith([], "ana.test@gmail.com")).toBe(false);
  });

  it("allows anyone when the file is shared by link", () => {
    expect(isSharedWith([{ type: "anyone" }], "other@gmail.com")).toBe(true);
  });
});
