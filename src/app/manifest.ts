import type { MetadataRoute } from "next";

/**
 * Web app manifest. "Add SOS to phone" installs ResQure as an app whose icon opens straight on the
 * SOS screen (/sos). Installing is also what makes push alerts work on iPhone.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/sos",
    name: "ResQure SOS",
    short_name: "SOS",
    description: "Hold one button for 3 seconds to send an SOS with your location.",
    start_url: "/sos",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#b3261e",
    theme_color: "#b3261e",
    icons: [
      { src: "/app/sos-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app/sos-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app/sos-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      { name: "Send SOS", url: "/sos", icons: [{ src: "/app/sos-192.png", sizes: "192x192" }] },
      { name: "Report an incident", url: "/" },
    ],
  };
}
