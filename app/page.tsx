import { Hero } from "@/components/hero/Hero";
import { ProjectionRoom } from "@/components/room/ProjectionRoom";
import { Work } from "@/components/work/Work";
import { Branches } from "@/components/experience/Branches";
import { Contact } from "@/components/contact/Contact";
import { Footer } from "@/components/footer/Footer";
import { RouteFocus } from "@/components/work/RouteFocus";

export default function Home() {
  return (
    <>
      <main id="main" tabIndex={-1}>
        <RouteFocus />
        <Hero />
        <ProjectionRoom />
        <Work />
        <Branches />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
