import { describe, expect, it } from "vitest";
import { familyEditingAllowed, canInsertFamilyMember } from "@/lib/familyAccess";
import { birthYearCode, toAuthPassword, FAMILY_CODE_RE } from "@/lib/authPassword";

describe("family access", () => {
  it("allows every authenticated family without a timed grant", () => {
    expect(familyEditingAllowed(true)).toBe(true);
    expect(familyEditingAllowed(false)).toBe(false);
  });
  it("permits a family to add its own members, not another family's", () => {
    expect(canInsertFamilyMember({ id: "family-a", canReview: false }, "family-a")).toBe(true);
    expect(canInsertFamilyMember({ id: "family-a", canReview: false }, "family-b")).toBe(false);
    expect(canInsertFamilyMember({ id: null, canReview: false }, "family-a")).toBe(false);
  });
  it("permits an authorized reviewer to add a family member", () => {
    expect(canInsertFamilyMember({ id: "reviewer", canReview: true }, "family-a")).toBe(true);
  });
  it("uses the head's four-digit birth year as the default password code", () => {
    expect(birthYearCode("1987-05-12")).toBe("1987");
    expect(toAuthPassword("1987")).toBe("Baraka2#1987");
    expect(FAMILY_CODE_RE.test("1987")).toBe(true);
    expect(FAMILY_CODE_RE.test("19870")).toBe(false);
  });
});