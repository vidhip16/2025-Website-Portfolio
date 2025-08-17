"use client"

import { motion } from "framer-motion"

/**
 * AboutSection
 * Displays a brief professional profile and core skills with animated progress bars.
 * Edit the copy and skills list below to personalize.
 */
export function AboutSection() {
  return (
    <section id="about" className="min-h-screen py-32 px-6">
      <div className="container mx-auto max-w-4xl">
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

          <div className="relative grid md:grid-cols-2 gap-8 items-center">
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
                  <div className="text-white font-bold">5+ Years</div>
                </div>
                <div className="p-4 border border-violet-500/20 rounded bg-black/20">
                  <div className="text-pink-400 font-mono text-sm">PROJECTS</div>
                  <div className="text-white font-bold">50+ Completed</div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-2xl font-bold text-violet-400 mb-4 font-mono">[CORE_SYSTEMS]</h3>
              {[
                { skill: "Cloud Architecture", level: 95 },
                { skill: "System Design", level: 90 },
                { skill: "DevOps & CI/CD", level: 88 },
                { skill: "Full-Stack Development", level: 85 },
                { skill: "Database Management", level: 92 },
              ].map((skill, index) => (
                <div key={skill.skill} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">{skill.skill}</span>
                    <span className="text-pink-400">{skill.level}%</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-pink-500 to-violet-500"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${skill.level}%` }}
                      transition={{ duration: 1, delay: index * 0.1 }}
                      viewport={{ once: true }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default AboutSection


