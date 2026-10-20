import type { Metadata, Viewport } from "next";
import "./globals.css";
import { serif, sans, departure } from "./fonts";
import { SITE_URL, mascot, person, seo } from "@/content/site";
import { SkipLink } from "@/components/shell/SkipLink";
import { Nav } from "@/components/shell/Nav";
import { SmoothScroll } from "@/components/shell/SmoothScroll";
import { MotionPrefs } from "@/components/shell/MotionPrefs";
import { JsonLd } from "@/components/seo/JsonLd";
import { TabSleep } from "@/components/footer/TabSleep";
import { ConsoleHello } from "@/components/footer/ConsoleHello";
import { PerfProbe } from "@/components/qa/PerfProbe";

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

// Runs before paint. data-motion is set first so a throwing storage API can't
// leave it unset (Work CSS reads a missing data-motion as "no JS"). Also applies
// the remembered Work view and the once-per-session entrance flag.
const bootScript = `(function(){var d=document.documentElement;d.dataset.motion='on';try{var r=matchMedia('(prefers-reduced-motion: reduce)').matches,p=false,w=null;try{p=localStorage.getItem('vp:motion-paused')==='1';w=localStorage.getItem('vp:work-view')}catch(e){}if(r||p)d.dataset.motion='off';if(w==='list'||w==='mosaic')d.dataset.workView=w;if(sessionStorage.getItem('vp:entered')){d.dataset.entered='1'}else{sessionStorage.setItem('vp:entered','1')}}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-CA"
      className={`${serif.variable} ${sans.variable} ${departure.variable}`}
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
        <TabSleep title={mascot.sleepTitle} />
        <ConsoleHello line={mascot.consoleLine} noun={mascot.noun} />
        <PerfProbe />
      </body>
    </html>
  );
}
