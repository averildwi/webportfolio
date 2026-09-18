import type { Metadata, Viewport } from "next";
import { Geist_Mono, Manrope } from "next/font/google";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { SocialLinkList } from "@/components/layout/social-link-list";
import { SITE_URL } from "@/lib/api/config";
import { loadSiteChrome } from "@/lib/data/site";
import "./globals.css";

/**
 * Variable fonts, self-hosted by next/font.
 *
 * next/font downloads these at build time and serves them from our own origin,
 * so there is no request to Google at runtime — better privacy, and no
 * third-party connection on the critical path.
 *
 * `display: "swap"` shows fallback text immediately rather than blocking on the
 * font, trading a brief reflow for faster first paint.
 */
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Site-wide metadata. Page-level exports merge over these.
 *
 * `metadataBase` resolves the relative URLs used in Open Graph tags; without
 * it, Next.js warns and social scrapers receive unusable relative paths.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Portfolio",
    // `%s` is replaced by each page's own title.
    template: "%s — Portfolio",
  },
  description:
    "Engineering portfolio: selected projects, experience, and writing.",
  openGraph: {
    type: "website",
    siteName: "Portfolio",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
  },
};

/**
 * `themeColor` tints browser UI on mobile to match the canvas, so the address
 * bar does not sit as a bright band above a dark page.
 */
export const viewport: Viewport = {
  themeColor: "#050303",
  colorScheme: "dark",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { name, socials } = await loadSiteChrome();

  return (
    <html
      lang="en"
      // `antialiased` matters on a dark background, where unsmoothed text
      // renders noticeably heavier than intended.
      className={`${manrope.variable} ${geistMono.variable} antialiased`}
    >
      <body className="flex min-h-dvh flex-col">
        <Header name={name} socials={<SocialLinkList links={socials} />} />
        {/* Target of the skip link. `pt-16` clears the fixed header; without
            it the first section would render underneath it. */}
        <div id="main" className="flex flex-1 flex-col pt-16 sm:pt-18">
          {children}
        </div>
        <Footer name={name} socials={socials} />
      </body>
    </html>
  );
}
