"use client"

import { motion, useMotionValue, useTransform, useAnimationFrame } from "framer-motion"
import { cn } from "@/lib/utils"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { badgeVariants } from "@/components/ui/badge"
import { useIsMobile } from "@/components/ui/use-mobile"
import React, { useCallback, useMemo, useState, useRef } from "react"
import type { LucideIcon } from "lucide-react"
import {
  Globe,
  Database,
  Cloud,
  Shield,
  GitBranch,
  Code,
  Code2,
  Cpu,
  Monitor,
  Terminal,
  Network,
  Braces,
  Brackets,
} from "lucide-react"
import Image from "next/image"
import { AspectRatio } from "@/components/ui/aspect-ratio"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * AboutSection
 * Displays a brief professional profile and core skills with animated progress bars.
 * Edit the copy and skills list below to personalize.
 */
export function AboutSection() {
  const isMobile = useIsMobile()

  const skills: {
    name: string
    summary: string
    tools: string[]
  }[] = [
    {
      name: "Cloud Architecture",
      summary:
        "Designing resilient, cost-efficient cloud topologies with strong isolation boundaries and observability.",
      tools: ["AWS", "GCP", "Terraform", "Kubernetes"],
    },
    {
      name: "System Design",
      summary:
        "End-to-end design of services with clear SLAs/SLOs, caching strategies, and graceful degradation paths.",
      tools: ["Event-Driven", "CQRS", "gRPC", "REST"],
    },
    {
      name: "DevOps & CI/CD",
      summary:
        "Building reliable pipelines and golden paths for fast, safe delivery with strong feedback loops.",
      tools: ["GitHub Actions", "ArgoCD", "Docker", "Helm"],
    },
    {
      name: "Full-Stack Development",
      summary:
        "From accessible, performant UIs to well-typed APIs with maintainable domain boundaries.",
      tools: ["Next.js", "TypeScript", "Node.js", "tRPC"],
    },
    {
      name: "Database Management",
      summary:
        "Modeling data for correctness and scale, with careful indexing, migrations, and backup strategies.",
      tools: ["PostgreSQL", "MySQL", "Prisma", "Redis"],
    },
  ]

  type WebSkill = {
    id: string
    name: string
    icon: LucideIcon
    summary: string
    ring: 1 | 2
  }

  const orbitSkills: WebSkill[] = useMemo(
    () => [
      // Core programming languages
      { id: "python", name: "Python", icon: Code2, summary: "Scripting, data tooling, and backend services.", ring: 1 },
      { id: "java", name: "Java", icon: Braces, summary: "Robust services with strong type safety.", ring: 1 },
      { id: "go", name: "Go", icon: Cpu, summary: "Fast, simple services and CLIs.", ring: 1 },
      { id: "cpp", name: "C++", icon: Brackets, summary: "Performance-critical components and tooling.", ring: 1 },
      { id: "ts-js", name: "TypeScript/JS", icon: Code, summary: "Typed web apps and tooling.", ring: 1 },

      // Platforms & infrastructure (outer ring only, trimmed to avoid clutter)
      { id: "linux", name: "Linux", icon: Terminal, summary: "Servers, tooling, and shell automation.", ring: 2 },
      { id: "networking", name: "Networking", icon: Network, summary: "Protocols, routing, and secure connectivity.", ring: 2 },
      { id: "db", name: "Databases", icon: Database, summary: "Relational modeling, indexing, and caching.", ring: 2 },
      { id: "apis", name: "APIs", icon: Globe, summary: "REST/gRPC design with clear contracts.", ring: 2 },
      { id: "cloud", name: "Cloud", icon: Cloud, summary: "AWS/GCP; secure, scalable infrastructure.", ring: 2 },
      { id: "ci", name: "CI/CD", icon: GitBranch, summary: "Automated builds, tests, and deployments.", ring: 2 },
      { id: "obs", name: "Observability", icon: Monitor, summary: "Metrics, logs, traces for fast feedback.", ring: 2 },
      { id: "security", name: "Security", icon: Shield, summary: "Secure defaults and threat-aware design.", ring: 2 },
    ],
    []
  )

  // Smooth, upright, pause-on-hover orbit ring with counter-rotation and direction
  const RingOrbit: React.FC<{ ring: 1 | 2; direction: 1 | -1; size: number }> = ({ ring, direction, size }) => {
    const durationMs = ring === 1 ? 60000 : 80000
    const rotation = useMotionValue(0)
    const counterRotation = useTransform(rotation, (r) => -r)
    const pausedRef = useRef(false)
    const degPerMs = (360 / durationMs) * direction

    useAnimationFrame((_, delta) => {
      if (pausedRef.current) return
      const next = (rotation.get() + delta * degPerMs) % 360
      rotation.set(next)
    })

    const items = orbitSkills.filter((s) => s.ring === ring)
    const radius = size / 2

    return (
      <motion.div
        className="absolute top-1/2 left-1/2 rounded-full border border-violet-500/20"
        style={{
          width: size,
          height: size,
          marginLeft: -size / 2,
          marginTop: -size / 2,
          rotate: rotation,
        }}
      >
        {items.map((s, i) => {
          const angle = (i / items.length) * 360
          const Icon = s.icon
          const content = (
            <div>
              <div className="text-sm font-semibold text-pink-400 mb-1">{s.name}</div>
              <p className="text-sm text-gray-300 leading-relaxed">{s.summary}</p>
            </div>
          )

          const trigger = (
            <motion.button
              onMouseEnter={() => (pausedRef.current = true)}
              onMouseLeave={() => (pausedRef.current = false)}
              whileHover={{ scale: 1.06 }}
              className={cn(
                "relative grid place-items-center h-8 w-8 rounded-full",
                "border border-pink-500/30 bg-black/60 shadow",
                "hover:bg-pink-500/10 hover:border-pink-500/50"
              )}
            >
              <Icon className="h-4 w-4 text-violet-300" />
              <span className="sr-only">{s.name}</span>
              <span className="absolute -z-10 h-8 w-8 rounded-full bg-violet-500/20 blur-xl" />
            </motion.button>
          )

          return (
            <div
              key={s.id}
              className="absolute top-1/2 left-1/2"
              style={{ transform: `rotate(${angle}deg) translateX(${radius}px) rotate(${-angle}deg)` }}
            >
              <motion.div style={{ rotate: counterRotation }}>
                <HoverCard>
                  <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
                  <HoverCardContent className="bg-black/80 border-pink-500/20" side="top" align="center">
                    {content}
                  </HoverCardContent>
                </HoverCard>
              </motion.div>
            </div>
          )
        })}
      </motion.div>
    )
  }

  const [tilt, setTilt] = useState<{ rx: number; ry: number }>({ rx: 0, ry: 0 })
  const [innerSize, setInnerSize] = useState<number>(200)
  const [outerSize, setOuterSize] = useState<number>(320)
  const [imageLoading, setImageLoading] = useState(true)
  const [imageError, setImageError] = useState(false)
  const galaxyRef = useRef<HTMLDivElement | null>(null)

  const handleMouseMove = useCallback<React.MouseEventHandler<HTMLDivElement>>(
    (e) => {
      if (isMobile) return
      const rect = e.currentTarget.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = (e.clientX - cx) / (rect.width / 2)
      const dy = (e.clientY - cy) / (rect.height / 2)
      const maxTilt = 8
      setTilt({ ry: dx * maxTilt, rx: -dy * maxTilt })
    },
    [isMobile]
  )
  const resetTilt = useCallback(() => setTilt({ rx: 0, ry: 0 }), [])

  // Measure container to ensure rings fit inside
  React.useEffect(() => {
    if (!galaxyRef.current) return
    const el = galaxyRef.current
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth
      const h = el.clientHeight
      const base = Math.max(0, Math.min(w, h) - 40) // padding for borders/glow
      const outer = Math.max(220, Math.floor(base))
      const inner = Math.max(160, Math.floor(base * 0.65))
      setOuterSize(outer)
      setInnerSize(inner)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <section id="about" className="min-h-screen py-32 px-6">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-pink-400 to-violet-400 bg-clip-text text-transparent mb-4">
            SYSTEM PROFILE
          </h2>
          <div className="w-24 h-1 bg-gradient-to-r from-pink-500 to-violet-500 mx-auto" />
        </motion.div>

        <motion.div
          className="relative p-8 border border-pink-500/30 bg-black/40 backdrop-blur-md rounded-lg glow-panel"
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          viewport={{ once: true }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-violet-500/5 rounded-lg" />

          <div className="relative grid md:grid-cols-3 gap-8 items-start">
            {/* Profile Data */}
            <div>
              <h3 className="text-2xl font-bold text-pink-400 mb-4 font-mono">[PROFILE_DATA]</h3>
              <p className="text-gray-300 leading-relaxed mb-6">
                Experienced IT professional specializing in system architecture, cloud infrastructure, and digital
                transformation. Passionate about creating innovative solutions that bridge the gap between complex
                technical requirements and user-friendly implementations.
              </p>
              <p className="text-gray-300 leading-relaxed mb-6">
                With expertise in modern development frameworks, DevOps practices, and emerging technologies, I
                architect scalable systems that drive business growth and operational efficiency.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border border-violet-500/20 rounded bg-black/20">
                  <div className="text-pink-400 font-mono text-sm">EXPERIENCE</div>
                  <div className="text-white font-bold">3+ Years</div>
                </div>
                <div className="p-4 border border-violet-500/20 rounded bg-black/20">
                  <div className="text-pink-400 font-mono text-sm">PROJECTS</div>
                  <div className="text-white font-bold">25+ Completed</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3">
                <div className="p-4 border border-violet-500/20 rounded bg-black/20">
                  <div className="text-pink-400 font-mono text-sm">HIGHLIGHTS</div>
                  <ul className="list-disc list-inside text-gray-300 text-sm space-y-1">
                    <li>Built small tools that automated repetitive tasks</li>
                    <li>Contributed documentation and improved onboarding</li>
                    <li>Shipped features with guidance and code reviews</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Skills Galaxy */}
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-violet-400 mb-2 font-mono">[SKILLS]</h3>

              {!isMobile && (
                <div
                  ref={galaxyRef}
                  className="relative w-full h-[30rem] md:h-[34rem] select-none"
                  onMouseMove={handleMouseMove}
                  onMouseLeave={resetTilt}
                  style={{ perspective: 1200 }}
                >
                  <motion.div
                    className="absolute inset-0 overflow-hidden rounded-xl border border-violet-500/20 bg-black/30 backdrop-blur glow-panel"
                    style={{
                      transformStyle: "preserve-3d",
                      transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
                    }}
                  >
                    <div
                      className="absolute inset-0 rounded-xl pointer-events-none"
                      style={{
                        backgroundImage:
                          "radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.35), transparent)," +
                          "radial-gradient(1px 1px at 40% 70%, rgba(255,255,255,0.25), transparent)," +
                          "radial-gradient(1px 1px at 80% 20%, rgba(255,255,255,0.25), transparent)," +
                          "radial-gradient(1px 1px at 70% 80%, rgba(255,255,255,0.2), transparent)," +
                          "radial-gradient(1px 1px at 30% 60%, rgba(255,255,255,0.3), transparent)",
                        backgroundRepeat: "no-repeat",
                      }}
                    />
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-pink-500/10 to-violet-500/10" />

                    <div className="absolute inset-0 grid place-items-center">
                      <div className="relative">
                        <div className="absolute -inset-6 rounded-full bg-pink-500/10 blur-xl" />
                        <div className="relative z-10 flex items-center gap-2 rounded-full border border-pink-500/40 bg-black/60 px-4 py-2">
                          <Globe className="h-4 w-4 text-pink-400" />
                          <span className="text-sm font-semibold text-white">Skills</span>
                        </div>
                      </div>
                    </div>

                    <RingOrbit ring={1} direction={1} size={innerSize} />
                    <RingOrbit ring={2} direction={-1} size={outerSize} />
                  </motion.div>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                {skills.map((s, index) => {
                  const triggerButton = (
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        badgeVariants({ variant: "outline" }),
                        "cursor-pointer border-violet-500/30 text-gray-200 hover:text-white",
                        "hover:bg-gradient-to-r hover:from-pink-500/20 hover:to-violet-500/20",
                        "hover:ring-1 hover:ring-pink-500/40 hover:border-pink-500/40",
                        "backdrop-blur-sm"
                      )}
                    >
                      {s.name}
                    </motion.button>
                  )

                  const content = (
                    <div>
                      <div className="text-sm font-semibold text-pink-400 mb-1">{s.name}</div>
                      <p className="text-sm text-gray-300 leading-relaxed">{s.summary}</p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {s.tools.map((t) => (
                          <span
                            key={t}
                            className={cn(
                              badgeVariants({ variant: "secondary" }),
                              "border-violet-500/20 bg-black/40 text-gray-200"
                            )}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )

                  return isMobile ? (
                    <Popover key={s.name}>
                      <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
                      <PopoverContent className="bg-black/80 border-pink-500/20">
                        {content}
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <HoverCard key={s.name}>
                      <HoverCardTrigger asChild>{triggerButton}</HoverCardTrigger>
                      <HoverCardContent className="bg-black/80 border-pink-500/20" side="top" align="start">
                        {content}
                      </HoverCardContent>
                    </HoverCard>
                  )
                })}
              </div>
            </div>

            {/* Headshot */}
            <div className="relative space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-pink-400 font-mono">[ME]</h3>
              </div>
              <motion.div
                whileHover={{ scale: 1.03, rotate: 0.5 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="relative rounded-xl border border-violet-500/30 overflow-hidden"
                data-hoverable
              >
                <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 to-violet-500/10" />
                <div className="relative w-full h-[30rem] md:h-[34rem]">
                  {imageLoading && (
                    <Skeleton className="absolute inset-0 w-full h-full bg-violet-500/20" />
                  )}
                  {!imageError ? (
                    <Image
                      src="/profile.JPG"
                      alt="Profile photo"
                      fill
                      className={`object-cover transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
                      priority
                      onLoad={() => setImageLoading(false)}
                      onError={() => {
                        setImageLoading(false)
                        setImageError(true)
                      }}
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-violet-500/10 text-violet-400">
                      <div className="text-center">
                        <div className="text-4xl mb-2">📷</div>
                        <div className="text-sm">Image unavailable</div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="pointer-events-none absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
                </div>
              </motion.div>
              <div className="p-4 border border-violet-500/20 rounded bg-black/20">
                <div className="text-pink-400 font-mono text-sm mb-1">HOBBIES</div>
                <p className="text-sm text-gray-300 leading-relaxed">
                  Music and film production • Building apps on the side • Competitive gaming (Valorant) • Tech tinkering & automation
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default AboutSection


