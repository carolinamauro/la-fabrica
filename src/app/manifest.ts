import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "La Fábrica",
    short_name: "La Fábrica",
    description: "Tu planificación de entrenamiento",
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // The installed app turns with the phone (Android locks it to portrait otherwise).
    orientation: "any",
    background_color: "#0a0c0c",
    theme_color: "#0a0c0c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
