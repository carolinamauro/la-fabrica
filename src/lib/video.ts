// Exercise videos from the LINKS column: how to show each kind of link inside the app.

/**
 * `embed`: a player page for an iframe; `file`: a video file for <video>; `link`: only opens
 * outside the app. `vertical` for phone-shaped clips (Shorts, Reels, TikToks).
 */
export type ExerciseVideo =
  | { kind: "embed"; url: string; src: string; vertical: boolean; source: string }
  | { kind: "file"; url: string; src: string; source: string }
  | { kind: "link"; url: string; source: string };

const URL_IN_TEXT = /https?:\/\/\S+/;

/** "1m30s", "90s" or "90" (YouTube's `t`) → seconds. */
function startSeconds(value: string | null): number {
  const match = value?.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
  if (!match) return 0;
  const [, h = "0", m = "0", s = "0"] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

function youtube(url: URL): ExerciseVideo | null {
  const host = url.hostname.replace(/^(www|m)\./, "");
  let id: string | undefined;
  let vertical = false;
  if (host === "youtu.be") id = url.pathname.split("/")[1];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const [, kind, value] = url.pathname.split("/");
    if (kind === "watch") id = url.searchParams.get("v") ?? undefined;
    else if (["shorts", "embed", "live", "v"].includes(kind)) id = value;
    vertical = kind === "shorts";
  } else return null;
  if (!id || !/^[\w-]{6,}$/.test(id)) return null;

  const src = new URL(`https://www.youtube-nocookie.com/embed/${id}`);
  src.searchParams.set("playsinline", "1");
  src.searchParams.set("rel", "0");
  const start = startSeconds(url.searchParams.get("t") ?? url.searchParams.get("start"));
  if (start) src.searchParams.set("start", String(start));
  return { kind: "embed", url: url.href, src: src.href, vertical, source: "YouTube" };
}

/** The video in a LINKS cell (the first link in it), or undefined if it has none. */
export function parseVideo(cell: string | undefined): ExerciseVideo | undefined {
  const raw = cell?.match(URL_IN_TEXT)?.[0];
  if (!raw) return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  const host = url.hostname.replace(/^www\./, "");
  const path = url.pathname.split("/").filter(Boolean);

  const fromYoutube = youtube(url);
  if (fromYoutube) return fromYoutube;

  if (host === "vimeo.com" && /^\d+$/.test(path[0] ?? "")) {
    return { kind: "embed", url: url.href, src: `https://player.vimeo.com/video/${path[0]}`, vertical: false, source: "Vimeo" };
  }
  if (host === "drive.google.com" && path[0] === "file" && path[1] === "d" && path[2]) {
    return { kind: "embed", url: url.href, src: `https://drive.google.com/file/d/${path[2]}/preview`, vertical: false, source: "Drive" };
  }
  if (host === "instagram.com" && ["p", "reel", "reels", "tv"].includes(path[0]) && path[1]) {
    return { kind: "embed", url: url.href, src: `https://www.instagram.com/p/${path[1]}/embed`, vertical: true, source: "Instagram" };
  }
  if (host === "tiktok.com" && path[1] === "video" && /^\d+$/.test(path[2] ?? "")) {
    return { kind: "embed", url: url.href, src: `https://www.tiktok.com/embed/v2/${path[2]}`, vertical: true, source: "TikTok" };
  }
  if (/\.(mp4|m4v|mov|webm)$/i.test(url.pathname)) {
    return { kind: "file", url: url.href, src: url.href, source: "video" };
  }
  return { kind: "link", url: url.href, source: host };
}
