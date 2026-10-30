import { describe, expect, it } from "vitest";
import { parsePlanRows } from "../src/lib/personalized";
import { parseVideo } from "../src/lib/video";

describe("parseVideo", () => {
  it("embeds YouTube links of every shape, keeping the start time", () => {
    const embed = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?playsinline=1&rel=0";
    expect(parseVideo("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toMatchObject({ kind: "embed", src: embed, vertical: false });
    expect(parseVideo("https://youtu.be/dQw4w9WgXcQ?si=abc")).toMatchObject({ src: embed });
    expect(parseVideo("https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s")).toMatchObject({ src: `${embed}&start=90` });
    expect(parseVideo("https://youtube.com/shorts/dQw4w9WgXcQ")).toMatchObject({ src: embed, vertical: true });
  });

  it("embeds Vimeo, Drive, Instagram and TikTok, and plays video files", () => {
    expect(parseVideo("https://vimeo.com/76979871")).toMatchObject({ src: "https://player.vimeo.com/video/76979871" });
    expect(parseVideo("https://drive.google.com/file/d/1AbC_d-9/view?usp=sharing")).toMatchObject({
      src: "https://drive.google.com/file/d/1AbC_d-9/preview",
    });
    expect(parseVideo("https://www.instagram.com/reel/C1x2Y3z/?igsh=x")).toMatchObject({
      src: "https://www.instagram.com/p/C1x2Y3z/embed",
      vertical: true,
    });
    expect(parseVideo("https://www.tiktok.com/@coach/video/7212345678901234567")).toMatchObject({
      src: "https://www.tiktok.com/embed/v2/7212345678901234567",
    });
    expect(parseVideo("https://cdn.example.com/demo.MP4")).toMatchObject({ kind: "file" });
  });

  it("takes the first link of a cell with text, and opens unknown sites outside the app", () => {
    expect(parseVideo("Ver: https://youtu.be/dQw4w9WgXcQ (lento)")).toMatchObject({ kind: "embed" });
    expect(parseVideo("https://example.com/squat")).toEqual({ kind: "link", url: "https://example.com/squat", source: "example.com" });
    expect(parseVideo("sin link")).toBeUndefined();
    expect(parseVideo(undefined)).toBeUndefined();
  });
});

describe("LINKS column", () => {
  it("is read wherever it is in BASE_PLANIFICACION", () => {
    const rows = [
      ["EJERCICIO", "LINKS", "SERIES", "ID", "SEMANA", "DIA", "ORDEN"],
      ["BACK SQUAT", "https://youtu.be/dQw4w9WgXcQ", "4", "ATL_A", "SEMANA 1", "DIA 1", "A"],
      ["REMO", "", "3", "ATL_A", "SEMANA 1", "DIA 1", "B"],
    ];
    const [squat, row] = parsePlanRows(rows, "ATL_A").map((r) => r.exercise);
    expect(squat).toMatchObject({ name: "BACK SQUAT", sets: "4", order: "A", video: { kind: "embed" } });
    expect(row.video).toBeUndefined();
  });
});
