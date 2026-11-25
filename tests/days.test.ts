import { describe, expect, it } from "vitest";
import { sameDayIn } from "../src/lib/days";

const weeks = [
  { week: "SEMANA 1", days: ["DIA 1", "DIA 2", "DIA 3"] },
  { week: "SEMANA 2", days: ["DIA 1", "DIA 2", "DIA 3"] },
  { week: "SEMANA 3", days: ["LUNES", "MIERCOLES"] },
];

describe("sameDayIn", () => {
  it("keeps the same day when the other week has it", () => {
    expect(sameDayIn(weeks[1], { week: "SEMANA 1", day: "DIA 3" }, weeks)).toEqual({ week: "SEMANA 2", day: "DIA 3" });
  });

  it("falls back to the same position, or the last day", () => {
    expect(sameDayIn(weeks[2], { week: "SEMANA 1", day: "DIA 2" }, weeks)).toEqual({ week: "SEMANA 3", day: "MIERCOLES" });
    expect(sameDayIn(weeks[2], { week: "SEMANA 1", day: "DIA 1" }, weeks)).toEqual({ week: "SEMANA 3", day: "LUNES" });
    expect(sameDayIn(weeks[2], { week: "SEMANA 2", day: "DIA 3" }, weeks)).toEqual({ week: "SEMANA 3", day: "MIERCOLES" });
  });
});
