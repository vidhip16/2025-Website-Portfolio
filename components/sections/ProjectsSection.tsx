"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Github } from "lucide-react"
import Image from "next/image"

/**
 * ProjectsSection
 * Cards for portfolio projects. Customize the list below with real projects.
 * Note: Filled with provided projects.
 */
export function ProjectsSection() {
  const projects = [
    {
      title: "HandleScout",
      image: "/portfolio.jpg",
      tools: ["Python", "REST APIs", "HTML", "CSS", "JavaScript"],
      description:
        "High-performance handle verification tool that checks real-time username availability across Instagram, TikTok, X, and YouTube. Responsive frontend with validation and optimized multi-platform API calls to streamline branding workflows.",
      href: "https://github.com/vidhip16/HandleScout",
    },
    {
      title: "Type Racer",
      image: "/typeracer.jpg",
      tools: ["JavaScript", "HTML", "CSS"],
      description:
        "Responsive typing game with live WPM tracking, DOM-based feedback, and animations. Selectable text lengths and real-time correctness highlighting.",
      href: "https://github.com/vidhip16/Type-Racer",
    },
    {
      title: "Nearest Washroom Finder",
      image: "/washroom.jpg",
      tools: ["React.js", "JavaScript", "OpenStreetMap API", "Axios"],
      description:
        "Location-based app to find public washrooms within 1.5 km using Overpass API and device geolocation. Interactive map and mobile-friendly UI.",
      href: "https://github.com/vidhip16/Nearest-Washroom-Locater",
    },
    {
      title: "Image Generator",
      image: "/portfolio.jpg",
      tools: ["HTML", "CSS", "JavaScript", "Node.js", "Express", "OpenAI API"],
      description:
        "Full-stack AI image generator with prompt input, live preview, and downloads. Node/Express backend proxies OpenAI API with secure key management.",
      href: "https://github.com/vidhip16/AI-Image-Generator",
    },
    {
      title: "Vertical Video Extender",
      image: "/project5.jpg",
      tools: ["React", "Python", "Flask", "HTML", "CSS", "JavaScript", "Bootstrap"],
      description:
        "Transforms horizontal videos into vertical format by generating missing visual space. Flask/OpenCV backend with responsive UI and mobile preview.",
      href: "https://github.com/vidhip16/Video-Enhancer",
    },
    {
      title: "Picture Converter",
      image: "/picconvert.jpg",
      tools: ["Python"],
      description:
        "Converts HEIC to JPG with batch folder support using Pillow/HEIF. Lightweight CLI utility for quick image prep and sharing.",
      href: "https://github.com/vidhip16/Picture-Converter",
    },
  ] as const

  return (
    <section id="projects" className="min-h-screen py-32 px-6">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-pink-400 to-violet-400 bg-clip-text text-transparent mb-4">
            PROJECT ARCHIVE
          </h2>
          <div className="w-24 h-1 bg-gradient-to-r from-pink-500 to-violet-500 mx-auto" />
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project, index) => (
            <motion.div
              key={project.title}
              className="group relative p-6 border border-violet-500/30 bg-black/40 backdrop-blur-md rounded-lg hover:border-pink-500/50 transition-all duration-300 project-card"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.02, y: -5 }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-pink-500/5 rounded-lg group-hover:from-pink-500/10 group-hover:to-violet-500/10 transition-all duration-300" />

              <div className="relative">
                <div className="mb-4 overflow-hidden rounded-md border border-violet-500/20">
                  <div className="relative w-full h-40">
                    <Image src={project.image} alt={project.title} fill className="object-cover" />
                  </div>
                </div>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-xl font-bold text-white group-hover:text-pink-400 transition-colors duration-300">
                    {project.title}
                  </h3>
                </div>

                <p className="text-gray-300 text-sm mb-3 leading-relaxed">{project.description}</p>

                <div className="flex flex-wrap gap-2 mb-4">
                  {project.tools.map((t) => (
                    <span key={t} className="px-2 py-1 text-xs bg-violet-500/20 text-violet-300 rounded font-mono">
                      {t}
                    </span>
                  ))}
                </div>

                <a href={project.href} target="_blank" rel="noreferrer">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full bg-transparent border-pink-500/30 text-pink-400 hover:bg-pink-500/10 hover:border-pink-500/50"
                  >
                    <Github className="w-4 h-4 mr-2" />
                    View on GitHub
                  </Button>
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default ProjectsSection


