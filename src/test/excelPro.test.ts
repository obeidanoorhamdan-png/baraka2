import { describe, it, expect } from "vitest";
import { isDue } from "@/lib/excelPro";
import { familyCompletion } from "@/lib/familyCompletion";

describe("scheduled export", () => {
  const now = new Date("2026-11-09T12:00:00Z");
  it("off never due", () => expect(isDue({ freq: "off", approvedOnly: true }, now)).toBe(false));
  it("weekly due after 7 days", () => {
    expect(isDue({ freq: "weekly", approvedOnly: true, lastRun: "2026-11-01T12:00:00Z" }, now)).toBe(true);
    expect(isDue({ freq: "weekly", approvedOnly: true, lastRun: "2026-11-05T12:00:00Z" }, now)).toBe(false);
  });
});

describe("family completion", () => {
  it("missing member id lowers percent", () => {
    const r = familyCompletion({ full_name: "a", national_id: "123456789", phone: "1", alt_phone: "2", birth_date: "1980-01-01", id_card_url: "x" },
      { original_residence: "a", current_landmark: "b" }, [{ full_name: "ب", national_id: "" }]);
    expect(r.percent).toBe(90);
    expect(r.missing).toEqual(["رقم هوية ب"]);
  });
});
