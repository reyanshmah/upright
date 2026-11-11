import type { Metadata, Viewport } from "next";
import { Archivo, Atkinson_Hyperlegible, Public_Sans } from "next/font/google";
import "../styles/tokens.css";
import "./globals.css";
import { RegisterSW } from "@/components/RegisterSW";
import { resolveDefaultTheme, THEME_IDS, THEME_STORAGE_KEY, THEMES } from "@/lib/themes";
import { FONT_KEY, FONT_PREFS, TEXT_KEY, TEXT_SIZES } from "@/lib/displayPrefs";

// Self-hosted at build time; the CSS variables are the ones styles/tokens.css names.
const atkinson = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-atkinson", display: "swap" });
const archivo = Archivo({ subsets: ["latin"], weight: ["800"], variable: "--font-archivo", display: "swap" });
const publicSans = Public_Sans({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-public-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Upright",
  description: "Home fall-risk screening with a phone camera, based on CDC STEADI tests.",
  applicationName: "Upright",
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, title: "Upright", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEMES["clinic-light"].bg },
    { media: "(prefers-color-scheme: dark)", color: THEMES["clinic-dark"].bg },
  ],
};

/**
 * Runs before first paint: the saved theme if valid, else the default from the
 * system's dark-mode and more-contrast settings; then the saved text size and
 * font (lib/displayPrefs.ts). Storage can throw (private mode, blocked site
 * data), so every access is guarded.
 */
const themeScript = `(function(){var d=document.documentElement,g=function(k){try{return localStorage.getItem(k)}catch(e){return null}},t=g(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(${JSON.stringify(THEME_IDS)}.indexOf(t)<0){var m=function(q){try{return window.matchMedia(q).matches}catch(e){return false}};t=(${resolveDefaultTheme.toString()})(m("(prefers-color-scheme: dark)"),m("(prefers-contrast: more)"))}d.setAttribute("data-theme",t);var x=g(${JSON.stringify(TEXT_KEY)});d.setAttribute("data-text",${JSON.stringify(TEXT_SIZES)}.indexOf(x)<0?"standard":x);var f=g(${JSON.stringify(FONT_KEY)});d.setAttribute("data-font",${JSON.stringify(FONT_PREFS)}.indexOf(f)<0?"standard":f)})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${atkinson.variable} ${archivo.variable} ${publicSans.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
