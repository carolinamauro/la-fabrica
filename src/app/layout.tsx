import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { TimerProvider } from "@/components/TimerProvider";
import "./globals.css";

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Condensed uppercase for headings and numbers, like gym boards and plates.
const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: "La Fábrica",
  description: "Tu planificación de entrenamiento",
  applicationName: "La Fábrica",
  // iOS "Add to Home Screen": open full screen with its own name and icon.
  appleWebApp: { capable: true, title: "La Fábrica", statusBarStyle: "black-translucent" },
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0c0c",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${barlow.variable} ${barlowCondensed.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <TimerProvider>{children}</TimerProvider>
      </body>
    </html>
  );
}
