import type { Metadata, Viewport } from "next";
import "./globals.css";
import { fraunces, mona, departure } from "./fonts";
import { SITE_URL, person, seo } from "@/content/site";
import { SkipLink } from "@/components/shell/SkipLink";
import { Nav } from "@/components/shell/Nav";
import { SmoothScroll } from "@/components/shell/SmoothScroll";
import { MotionPrefs } from "@/components/shell/MotionPrefs";
import { JsonLd } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: seo.title,
  description: seo.description,
  applicationName: person.name,
  authors: [{ name: person.name, url: SITE_URL }],
  creator: person.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "profile",
    url: "/",
    siteName: person.name,
    title: seo.title,
    description: seo.description,
    locale: "en_CA",
    firstName: person.firstName,
    lastName: person.lastName,
  },
  twitter: {
    card: "summary_large_image",
    title: seo.title,
    description: seo.description,
  },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#F6F1FA",
  colorScheme: "light",
};

// Runs before paint: motion preference + once-per-session entrance flag.
const bootScript = `(function(){try{var d=document.documentElement;var r=matchMedia('(prefers-reduced-motion: reduce)').matches;var p=localStorage.getItem('vp:motion-paused')==='1';d.dataset.motion=(r||p)?'off':'on';if(sessionStorage.getItem('vp:entered')){d.dataset.entered='1'}else{sessionStorage.setItem('vp:entered','1')}}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-CA"
      className={`${fraunces.variable} ${mona.variable} ${departure.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body>
        <SkipLink />
        <Nav />
        <SmoothScroll />
        <MotionPrefs />
        {children}
        <JsonLd />
      </body>
    </html>
  );
}
