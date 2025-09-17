"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { motion } from "framer-motion"
import { ChevronDown, Download, Calendar, Award, Code, Briefcase } from "lucide-react"
import { Button } from "@/components/ui/button"
import AboutSection from "@/components/sections/AboutSection"
import ProjectsSection from "@/components/sections/ProjectsSection"
import ContactSection from "@/components/sections/ContactSection"
import { LoadingFallback } from "@/components/LoadingFallback"
import { ErrorBoundary } from "@/components/ErrorBoundary"

/**
 * CustomCursor
 * High-performance custom cursor that follows the pointer with an easing spring
 * using requestAnimationFrame and GPU-accelerated transforms. It also grows when
 * hovering over interactive controls detected via event delegation.
 */
function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement | null>(null)
  const targetX = useRef(0)
  const targetY = useRef(0)
  const currentX = useRef(0)
  const currentY = useRef(0)
  const rafId = useRef<number | null>(null)

  useEffect(() => {
    const el = cursorRef.current
    if (!el) return

    const handleMouseMove = (e: MouseEvent) => {
      targetX.current = e.clientX
      targetY.current = e.clientY
      if (rafId.current === null) tick()
    }

    const tick = () => {
      const dx = targetX.current - currentX.current
      const dy = targetY.current - currentY.current
      // Easing factor for smoothness; lower is smoother/slower, higher is snappier
      const ease = 0.18
      currentX.current += dx * ease
      currentY.current += dy * ease
      el.style.transform = `translate3d(${currentX.current - 10}px, ${currentY.current - 10}px, 0)`
      rafId.current = requestAnimationFrame(tick)
    }

    const handlePointerOver = (e: Event) => {
      const target = e.target as HTMLElement
      if (!target) return
      if (target.closest("button, a, input, textarea, select, [data-hoverable]")) {
        el.classList.add("hover")
      }
    }
    const handlePointerOut = (e: Event) => {
      const target = e.target as HTMLElement
      if (!target) return
      if (target.closest("button, a, input, textarea, select, [data-hoverable]")) {
        el.classList.remove("hover")
      }
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("pointerover", handlePointerOver, true)
    document.addEventListener("pointerout", handlePointerOut, true)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("pointerover", handlePointerOver, true)
      document.removeEventListener("pointerout", handlePointerOut, true)
      if (rafId.current !== null) cancelAnimationFrame(rafId.current)
    }
  }, [])

  return <div ref={cursorRef} className="cursor" aria-hidden="true" />
}

/**
 * Starfield
 * Canvas-based starfield that twinkles smoothly and occasionally emits
 * shooting stars. Uses requestAnimationFrame and off-main-thread friendly
 * math with low allocations for performance on slower devices.
 */
function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const starsRef = useRef<Array<{ x: number; y: number; r: number; baseA: number; t: number; glow: boolean; glowI: number; glowPhase: number }>>([])
  const shootersRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; life: number }>>([])
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d", { alpha: true })
    if (!ctx) return
    ctxRef.current = ctx

    // Handle high-DPI while capping for perf
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75)
      const { innerWidth: w, innerHeight: h } = window
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener("resize", resize)

    // Initialize stars
    const starCount = Math.min(160, Math.floor(window.innerWidth / 6))
    starsRef.current = new Array(starCount).fill(0).map(() => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.6 + 0.2,
      baseA: Math.random() * 0.6 + 0.2,
      t: Math.random() * Math.PI * 2,
      glow: Math.random() < 0.25,
      glowI: Math.random() * 0.5 + 0.15,
      glowPhase: Math.random() * Math.PI * 2,
    }))

    const step = () => {
      if (!ctxRef.current || !canvasRef.current) return
      const ctx = ctxRef.current
      const w = canvasRef.current.clientWidth
      const h = canvasRef.current.clientHeight

      ctx.clearRect(0, 0, w, h)

      // Twinkling stars with subtle random glow on a subset
      for (const s of starsRef.current) {
        s.t += 0.02
        const alpha = s.baseA + Math.sin(s.t) * 0.15
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha))
        ctx.fillStyle = "white"
        if (s.glow) {
          s.glowPhase += 0.03 + Math.random() * 0.01
          const flicker = (Math.sin(s.glowPhase) + 1) / 2 // 0..1
          const intensity = s.glowI * (0.4 + flicker * 0.6) // keep subtle
          ctx.shadowBlur = 4
          ctx.shadowColor = `rgba(255, 160, 255, ${intensity})`
        } else {
          ctx.shadowBlur = 0
        }
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
      }

      // Shooting stars (reduced frequency for subtlety)
      if (Math.random() < 0.005 && shootersRef.current.length < 2) {
        const startY = Math.random() * h * 0.5
        shootersRef.current.push({
          x: -40,
          y: startY,
          vx: 8 + Math.random() * 4,
          vy: 2 + Math.random() * 2,
          life: 1,
        })
      }

      for (let i = shootersRef.current.length - 1; i >= 0; i--) {
        const sh = shootersRef.current[i]
        sh.x += sh.vx
        sh.y += sh.vy
        sh.life -= 0.012

        // Trail
        const grad = ctx.createLinearGradient(sh.x - sh.vx * 3, sh.y - sh.vy * 3, sh.x, sh.y)
        grad.addColorStop(0, "rgba(255,255,255,0)")
        grad.addColorStop(1, "rgba(255,255,255,0.9)")
        ctx.globalAlpha = Math.max(0, sh.life)
        ctx.strokeStyle = grad as unknown as string
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(sh.x - sh.vx * 3, sh.y - sh.vy * 3)
        ctx.lineTo(sh.x, sh.y)
        ctx.stroke()

        // Head (brighter)
        ctx.globalAlpha = Math.max(0, sh.life)
        ctx.fillStyle = "white"
        ctx.beginPath()
        ctx.arc(sh.x, sh.y, 2.5, 0, Math.PI * 2)
        ctx.fill()

        if (sh.life <= 0 || sh.x > w + 40 || sh.y > h + 40) {
          shootersRef.current.splice(i, 1)
        }
      }

      ctx.globalAlpha = 1
      ctx.shadowBlur = 0
      rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)

    return () => {
      window.removeEventListener("resize", resize)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])


  return <canvas ref={canvasRef} className="absolute inset-0" aria-hidden="true" />
}

export default function FuturisticPortfolio() {
  const [activeSection, setActiveSection] = useState("home")
  const [scrollProgress, setScrollProgress] = useState(0)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)
    
    const handleChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mediaQuery.addEventListener('change', handleChange)
    
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight
      const progress = (window.scrollY / totalHeight) * 100
      setScrollProgress(progress)

      // Update active section based on scroll position
      const sections = ["home", "about", "projects", "resume", "contact"]
      const sectionElements = sections.map((id) => document.getElementById(id))

      for (let i = sectionElements.length - 1; i >= 0; i--) {
        const element = sectionElements[i]
        if (element && element.offsetTop <= window.scrollY + 200) {
          setActiveSection(sections[i])
          break
        }
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-black text-white overflow-x-hidden">
        {/* Custom Futuristic Cursor (GPU-accelerated) */}
        <CustomCursor />
      {/* Background Tech Pattern - Brighter */}
      <div className="fixed inset-0 opacity-30">
        <div className="absolute inset-0 bg-tech-pattern" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-b border-pink-500/20">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <motion.button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="text-left text-xl font-bold bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              VP
            </motion.button>

            <div className="hidden md:flex space-x-8">
              {["home", "about", "projects", "resume", "contact"].map((section) => (
                <button
                  key={section}
                  onClick={() => scrollToSection(section)}
                  className={`relative px-4 py-2 text-sm uppercase tracking-wider transition-all duration-300 ${
                    activeSection === section ? "text-pink-400 glow-text" : "text-gray-400 hover:text-pink-400"
                  }`}
                >
                  {section}
                  {activeSection === section && (
                    <motion.div
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-pink-500 to-violet-500"
                      layoutId="activeTab"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div
          className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-pink-500 to-violet-500 transition-all duration-300"
          style={{ width: `${scrollProgress}%` }}
        />
      </nav>

      {/* Home Section */}
      <section id="home" className="min-h-screen flex items-center justify-center relative py-20">
        <div className="text-center z-10">
          {/* Central Holographic Badge */}
          <motion.div
            className="relative mb-12"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{
              opacity: 1,
              scale: 1,
            }}
            transition={{ duration: 1, delay: 0.5 }}
          >
            <motion.div
              animate={{
                boxShadow: [
                  "0 0 20px rgba(255, 0, 128, 0.3)",
                  "0 0 40px rgba(255, 0, 128, 0.5)",
                  "0 0 20px rgba(255, 0, 128, 0.3)",
                ],
              }}
              transition={{
                duration: 3,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }}
              className="relative p-8 border border-pink-500/30 bg-black/40 backdrop-blur-md rounded-lg glow-panel"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 to-violet-500/10 rounded-lg" />
              <motion.h1
                className="text-6xl md:text-8xl font-bold bg-gradient-to-r from-pink-400 via-violet-400 to-pink-400 bg-clip-text text-transparent mb-4"
                animate={{
                  backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                }}
                transition={{
                  duration: 3,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "linear",
                }}
                style={{ backgroundSize: "200% 200%" }}
              >
                <span className="select-none">
                  VIDHI
                </span>{" "}PATEL
              </motion.h1>
              <p className="text-xl text-gray-300 font-mono">IT PROFESSIONAL • SYSTEM ARCHITECT</p>

              {/* Animated Corner Brackets */}
              <div className="absolute top-2 left-2 w-4 h-4 border-l-2 border-t-2 border-pink-500" />
              <div className="absolute top-2 right-2 w-4 h-4 border-r-2 border-t-2 border-pink-500" />
              <div className="absolute bottom-2 left-2 w-4 h-4 border-l-2 border-b-2 border-pink-500" />
              <div className="absolute bottom-2 right-2 w-4 h-4 border-r-2 border-b-2 border-pink-500" />
            </motion.div>
          </motion.div>

          {/* Command Modules */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto px-6">
            {[
              { id: "about", label: "ABOUT", icon: "01" },
              { id: "projects", label: "PROJECTS", icon: "02" },
              { id: "resume", label: "RESUME", icon: "03" },
              { id: "contact", label: "CONTACT", icon: "04" },
            ].map((module, index) => (
              <motion.button
                key={module.id}
                className="group relative p-6 border border-violet-500/30 bg-black/40 backdrop-blur-md rounded-lg hover:border-pink-500/50 transition-all duration-300 command-module"
                onClick={() => scrollToSection(module.id)}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8 + index * 0.1 }}
                whileHover={{ scale: 1.05, y: -5 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-pink-500/5 rounded-lg group-hover:from-pink-500/10 group-hover:to-violet-500/10 transition-all duration-300 pointer-events-none" />

                <div className="relative">
                  <div className="text-xs text-pink-400 font-mono mb-2">[{module.icon}]</div>
                  <div className="text-lg font-bold text-white group-hover:text-pink-400 transition-colors duration-300">
                    {module.label}
                  </div>

                  {/* Pulse Animation */}
                  <div className="absolute -inset-1 bg-gradient-to-r from-pink-500/20 to-violet-500/20 rounded-lg opacity-0 group-hover:opacity-100 blur transition-all duration-300" />
                </div>
              </motion.button>
            ))}
          </div>

          {/* Scroll Indicator */}
          <motion.div
            className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
          >
            <ChevronDown className="w-6 h-6 text-pink-400" />
          </motion.div>
        </div>

        {/* GPU starfield with occasional shooting stars */}
        <Starfield />
      </section>

      {/* About Section */}
      <Suspense fallback={<LoadingFallback message="Loading profile..." />}>
        <AboutSection />
      </Suspense>

      {/* Projects Section */}
      <Suspense fallback={<LoadingFallback message="Loading projects..." />}>
        <ProjectsSection />
      </Suspense>

      {/* Resume Section */}
      <section id="resume" className="min-h-screen py-32 px-6">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-pink-400 to-violet-400 bg-clip-text text-transparent mb-4">
              CAREER TIMELINE
            </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-pink-500 to-violet-500 mx-auto mb-8" />

            <div className="relative z-20">
              <Button 
                asChild 
                variant="outline" 
                className="bg-transparent border-pink-500/30 text-pink-400 hover:bg-pink-500/10 hover:border-pink-500/50 transition-all duration-300"
              >
                <a 
                  href="/resume.pdf" 
                  download 
                  target="_blank" 
                  rel="noreferrer noopener"
                  className="inline-flex items-center justify-center gap-2 w-full h-full px-4 py-2"
                  data-hoverable="true"
                >
                  <Download className="w-4 h-4 mr-2" /> DOWNLOAD RESUME (PDF)
                </a>
              </Button>
            </div>
          </motion.div>

          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-pink-500 to-violet-500" />

            <div className="space-y-12">
              {[
                {
                  year: "2024 — Present",
                  title: "IT Intern",
                  company: "Vortex Freight Systems",
                  description:
                    "Supporting internal tooling, automation scripts, and system maintenance. Contributed to documentation and improved onboarding for faster developer ramp-up.",
                  icon: Briefcase,
                },
                {
                  year: "2023 — Present",
                  title: "B.A. in Information Technology",
                  company: "York University",
                  description:
                    "Coursework in systems design, networking, web development, and software engineering. Active in hands-on projects that connect theory to practical outcomes.",
                  icon: Award,
                },
              ].map((item, index) => (
                <motion.div
                  key={item.year}
                  className="relative flex items-start"
                  initial={{ opacity: 0, x: -50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  {/* Timeline Node */}
                  <div className="relative z-10 flex items-center justify-center w-16 h-16 bg-black border-2 border-pink-500 rounded-full mr-6">
                    <item.icon className="w-6 h-6 text-pink-400" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-6 border border-violet-500/30 bg-black/40 backdrop-blur-md rounded-lg glow-panel">
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-pink-500/5 rounded-lg" />

                    <div className="relative">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-pink-400 font-mono text-sm">[{item.year}]</span>
                        <Calendar className="w-4 h-4 text-violet-400" />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-1">{item.title}</h3>
                      <p className="text-violet-400 font-semibold mb-3">{item.company}</p>
                      <p className="text-gray-300 text-sm leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <Suspense fallback={<LoadingFallback message="Loading contact..." />}>
        <ContactSection />
      </Suspense>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-pink-500/20 bg-black/80">
        <div className="container mx-auto text-center">
          <p className="text-gray-400 font-mono text-sm">© 2024 VIDHI PATEL • SYSTEM ARCHITECT • ALL RIGHTS RESERVED</p>
        </div>
      </footer>
      </div>
    </ErrorBoundary>
  )
}
