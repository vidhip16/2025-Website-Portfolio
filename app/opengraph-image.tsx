import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { mascot, person, seo } from "@/content/site";

// 1200×630 share card: the H9 art (Ping peeking up on the right third) with
// the name set in the static Fraunces 800 TTF (Satori can't read woff2 or
// variation axes, blueprint §1.4).
export const alt = `${person.name}: ${seo.ogLine}. ${mascot.alt} peeks up from the corner.`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const font = await readFile(join(process.cwd(), "assets/fonts/Fraunces-800.ttf"));
const artSrc = `data:image/jpeg;base64,${(await readFile(join(process.cwd(), "assets/og/og-art.jpg"))).toString("base64")}`;

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#F6F1FA" }}>
        <img src={artSrc} width={1200} height={630} alt="" style={{ position: "absolute", inset: 0 }} />
        <div
          style={{
            position: "absolute",
            left: 72,
            top: 0,
            bottom: 0,
            width: 640,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            color: "#23162E",
          }}
        >
          <div style={{ fontFamily: "Fraunces", fontSize: 148, lineHeight: 0.86, letterSpacing: "-0.035em", display: "flex", flexDirection: "column" }}>
            <span>{person.firstName}</span>
            <span>{person.lastName}</span>
          </div>
          <div style={{ marginTop: 36, fontFamily: "Fraunces", fontSize: 34, lineHeight: 1.2, maxWidth: 560 }}>{seo.ogLine}</div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Fraunces", data: font, weight: 800, style: "normal" }] },
  );
}
