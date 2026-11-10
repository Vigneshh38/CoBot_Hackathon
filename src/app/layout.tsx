import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "./backdrop.css";
import { AlertOverlay } from "@/components/AlertOverlay";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "ResQure — Emergency Response",
  description: "Report emergencies and coordinate disaster response.",
};

export const viewport: Viewport = { themeColor: "#9a7650", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}<AlertOverlay /></body>
    </html>
  );
}
