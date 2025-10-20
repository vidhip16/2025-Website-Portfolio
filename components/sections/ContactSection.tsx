"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Mail, Phone, MapPin, Github, Linkedin, Download, Calendar, Loader2, CheckCircle, AlertCircle } from "lucide-react"
import { useState } from "react"

/**
 * ContactSection
 * Contact info and a functional form with loading states and error handling.
 * Includes a resume download button pointing to /resume.pdf in the public folder.
 */
export function ContactSection() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear error state when user starts typing
    if (submitStatus === 'error') {
      setSubmitStatus('idle')
      setErrorMessage('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Basic validation
    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      setSubmitStatus('error')
      setErrorMessage('Please fill in all fields')
      return
    }

    setIsSubmitting(true)
    setSubmitStatus('idle')

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (response.ok) {
        setSubmitStatus('success')
        setFormData({ name: '', email: '', message: '' })
        // Reset success state after 5 seconds
        setTimeout(() => setSubmitStatus('idle'), 5000)
      } else {
        setSubmitStatus('error')
        setErrorMessage(result.error || 'Failed to send message. Please try again.')
      }
    } catch (error) {
      setSubmitStatus('error')
      setErrorMessage('Network error. Please check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }
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
          <div className="relative z-20 mt-8">
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
                  <a href="mailto:vidhipat15@gmail.com" className="flex items-center space-x-4 p-3 border border-pink-500/20 rounded bg-black/20 hover:border-pink-500/40 transition-colors">
                    <Mail className="w-5 h-5 text-pink-400" />
                    <div>
                      <div className="text-xs text-gray-400 font-mono">EMAIL</div>
                      <div className="text-white underline underline-offset-2">vidhipat2005@gmail.com</div>
                    </div>
                  </a>

                  <a href="tel:+16475280680" className="flex items-center space-x-4 p-3 border border-pink-500/20 rounded bg-black/20 hover:border-pink-500/40 transition-colors">
                    <Phone className="w-5 h-5 text-pink-400" />
                    <div>
                      <div className="text-xs text-gray-400 font-mono">PHONE</div>
                      <div className="text-white underline underline-offset-2">+1 (647) 528-0680</div>
                    </div>
                  </a>

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
            <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-violet-500/5 rounded-lg pointer-events-none" />

            <div className="relative">
              <h3 className="text-2xl font-bold text-violet-400 mb-6 font-mono">[MESSAGE_INTERFACE]</h3>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label className="block text-xs text-gray-400 font-mono mb-2">NAME</label>
                  <Input
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="bg-black/50 border-violet-500/30 text-white focus:border-pink-500/50 focus:ring-pink-500/20"
                    placeholder="Enter your name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 font-mono mb-2">EMAIL</label>
                  <Input
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="bg-black/50 border-violet-500/30 text-white focus:border-pink-500/50 focus:ring-pink-500/20"
                    placeholder="Enter your email"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 font-mono mb-2">MESSAGE</label>
                  <Textarea
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    className="bg-black/50 border-violet-500/30 text-white focus:border-pink-500/50 focus:ring-pink-500/20 min-h-[120px]"
                    placeholder="Enter your message"
                    required
                  />
                </div>

                {/* Status Messages */}
                {submitStatus === 'success' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded text-green-400"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm">Message sent successfully!</span>
                  </motion.div>
                )}

                {submitStatus === 'error' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400"
                  >
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">{errorMessage}</span>
                  </motion.div>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600 text-white font-bold py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      TRANSMITTING...
                    </>
                  ) : (
                    'TRANSMIT MESSAGE'
                  )}
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


