import type { MetadataRoute } from "next";

/** Installable app (PWA): opens straight into live TV, icon = Mr. Static. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "MIRAGE — Live AI TV",
    short_name: "MIRAGE",
    description: "24/7 interdimensional AI television: live channels, chat, a host who reacts to you.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#07070b",
    theme_color: "#07070b",
    categories: ["entertainment", "video"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "Live TV", url: "/?source=pwa-shortcut", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "TV guide", url: "/tv/guide", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
