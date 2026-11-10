import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const inter = localFont({
  src: [
    { path: "../fonts/Inter-Regular.otf", weight: "400" },
    { path: "../fonts/Inter-Medium.otf", weight: "500" },
    { path: "../fonts/Inter-SemiBold.otf", weight: "600" },
    { path: "../fonts/Inter-Bold.otf", weight: "700" },
  ],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Intradage",
  description: "Het interne platform van Bram Ladage",
  applicationName: "Intradage",
};

export const viewport: Viewport = {
  themeColor: "#16336e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nl" className={`${inter.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
