import { Hero } from "@/components/hero/Hero";
import { ProjectionRoom } from "@/components/room/ProjectionRoom";
import { Work } from "@/components/work/Work";
import { Branches } from "@/components/experience/Branches";
import { Contact } from "@/components/contact/Contact";
import { Footer } from "@/components/footer/Footer";

export default function Home() {
  return (
    <>
      <main id="main" tabIndex={-1}>
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
