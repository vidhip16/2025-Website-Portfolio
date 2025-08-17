"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Mail, Phone, MapPin, Github, Linkedin, Download, Calendar } from "lucide-react"

/**
 * ContactSection
 * Contact info and a basic form. The form is UI-only; wire it to an API or service as needed.
 * Includes a resume download button pointing to /resume.pdf in the public folder.
 * Note: Fill this in with your own contact info.
 */
export function ContactSection() {
  return (
    <section id="contact" className="min-h-screen py-32 px-6">
      <div className="container mx-auto max-w-4xl">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-pink-400 to-violet-400 bg-clip-text text-transparent mb-4">
            ESTABLISH CONNECTION
          </h2>
          <div className="w-24 h-1 bg-gradient-to-r from-pink-500 to-violet-500 mx-auto" />

          {/* Resume download (expects /public/resume.pdf) */}
          <Button
            asChild
            variant="outline"
            className="mt-8 bg-transparent border-pink-500/30 text-pink-400 hover:bg-pink-500/10 hover:border-pink-500/50"
          >
            <a href="/resume.pdf" download>
              <Download className="w-4 h-4 mr-2" /> DOWNLOAD RESUME (PDF)
            </a>
          </Button>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Contact Info */}
          <motion.div
            className="space-y-6"
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <div className="p-6 border border-pink-500/30 bg-black/40 backdrop-blur-md rounded-lg glow-panel">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-pink-500/5 rounded-lg" />

              <div className="relative">
                <h3 className="text-2xl font-bold text-pink-400 mb-6 font-mono">[CONTACT_PROTOCOLS]</h3>

                <div className="space-y-4">
                  <div className="flex items-center space-x-4 p-3 border border-pink-500/20 rounded bg-black/20">
                    <Mail className="w-5 h-5 text-pink-400" />
                    <div>
                      <div className="text-xs text-gray-400 font-mono">EMAIL</div>
                      <div className="text-white">vidhiemail@email.com</div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 p-3 border border-pink-500/20 rounded bg-black/20">
                    <Phone className="w-5 h-5 text-pink-400" />
                    <div>
                      <div className="text-xs text-gray-400 font-mono">PHONE</div>
                      <div className="text-white">+1 (647) 528-0680</div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 p-3 border border-pink-500/20 rounded bg-black/20">
                    <MapPin className="w-5 h-5 text-pink-400" />
                    <div>
                      <div className="text-xs text-gray-400 font-mono">LOCATION</div>
                      <div className="text-white">Toronto, ON</div>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-4 mt-6">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="bg-transparent border-pink-500/30 text-pink-400 hover:bg-pink-500/10 hover:border-pink-500/50"
                  >
                    <a href="https://github.com/vidhip16" target="_blank" rel="noreferrer noopener">
                      <Github className="w-4 h-4 mr-2" /> GitHub
                    </a>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="bg-transparent border-violet-500/30 text-violet-400 hover:bg-violet-500/10 hover:border-violet-500/50"
                  >
                    <a href="https://www.linkedin.com/in/vidhi-patel-717256309/" target="_blank" rel="noreferrer noopener">
                      <Linkedin className="w-4 h-4 mr-2" /> LinkedIn
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Contact Form (UI only) */}
          <motion.div
            className="p-6 border border-pink-500/30 bg-black/40 backdrop-blur-md rounded-lg glow-panel"
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-violet-500/5 rounded-lg" />

            <div className="relative">
              <h3 className="text-2xl font-bold text-violet-400 mb-6 font-mono">[MESSAGE_INTERFACE]</h3>

              <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                <div>
                  <label className="block text-xs text-gray-400 font-mono mb-2">NAME</label>
                  <Input
                    className="bg-black/50 border-violet-500/30 text-white focus:border-pink-500/50 focus:ring-pink-500/20"
                    placeholder="Enter your name"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 font-mono mb-2">EMAIL</label>
                  <Input
                    type="email"
                    className="bg-black/50 border-violet-500/30 text-white focus:border-pink-500/50 focus:ring-pink-500/20"
                    placeholder="Enter your email"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 font-mono mb-2">MESSAGE</label>
                  <Textarea
                    className="bg-black/50 border-violet-500/30 text-white focus:border-pink-500/50 focus:ring-pink-500/20 min-h-[120px]"
                    placeholder="Enter your message"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600 text-white font-bold py-3"
                >
                  TRANSMIT MESSAGE
                </Button>
              </form>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

export default ContactSection


