import type { Metadata, Viewport } from "next";
import { SosButton } from "@/components/SosButton";
import { RegisterSW } from "@/components/RegisterSW";

export const metadata: Metadata = {
  title: "ResQure SOS",
  description: "Hold for 3 seconds to send an SOS with your location.",
  appleWebApp: { capable: true, title: "SOS", statusBarStyle: "black-translucent" },
  icons: { apple: "/app/sos-192.png" },
};

export const viewport: Viewport = { themeColor: "#b3261e" };

/** The installed SOS app opens here: one hold-to-send button and nothing else to think about. */
export default function SosPage() {
  return (
    <main className="sos-app">
      <RegisterSW />
      <SosButton />
      <a href="tel:112" className="sos-app-call">Can&apos;t wait? Call 112</a>
    </main>
  );
}
