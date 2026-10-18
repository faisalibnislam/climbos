import type { MetadataRoute } from "next";

/** Install ClimbOS on a phone or desktop (approve from your home screen). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ClimbOS",
    short_name: "ClimbOS",
    description: "Your AI growth team.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#f7f6f2",
    theme_color: "#0b5d46",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
