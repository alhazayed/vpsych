import { Newsreader, Source_Sans_3, Geist_Mono } from "next/font/google";

// "Case file" design: Newsreader serif for English headings and names, Noto
// Kufi Arabic for Arabic headings, Source Sans 3 and Noto Sans Arabic for
// text. Both Arabic fonts are declared in globals.css, not here:
// --font-headline and --font-text put them first, limited to Arabic code
// points, because next/font's fallback faces (local Times New Roman for
// Newsreader, local Arial for Source Sans 3) have Arabic glyphs on Windows
// and macOS and would otherwise catch Arabic text first.
//
// Shared by the root layout and global-error.tsx, which replaces the layout
// (and its <html> class) when the layout itself fails.
const serifLatin = Newsreader({
  variable: "--font-serif-latin",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const body = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Class names that define --font-serif-latin, --font-body and --font-geist-mono. */
export const fontVariables = `${serifLatin.variable} ${body.variable} ${mono.variable}`;
