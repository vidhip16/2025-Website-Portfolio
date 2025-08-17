"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ExternalLink } from "lucide-react"

/**
 * ProjectsSection
 * Cards for portfolio projects. Customize the list below with real projects.
 * Note: Fill this in with your own projects.
 */
export function ProjectsSection() {
  const projects = [
    {
      title: "Cloud Migration Platform",
      description:
        "Enterprise-scale cloud migration tool with automated deployment pipelines and monitoring.",
      tech: ["AWS", "Kubernetes", "Docker", "Terraform"],
      status: "ACTIVE",
    },
    {
      title: "AI-Powered Analytics Dashboard",
      description:
        "Real-time data visualization platform with machine learning insights and predictive analytics.",
      tech: ["React", "Python", "TensorFlow", "PostgreSQL"],
      status: "DEPLOYED",
    },
    {
      title: "Microservices Architecture",
      description: "Scalable microservices ecosystem with API gateway and service mesh implementation.",
      tech: ["Node.js", "MongoDB", "Redis", "GraphQL"],
      status: "ACTIVE",
    },
    {
      title: "DevOps Automation Suite",
      description: "Complete CI/CD pipeline automation with testing, deployment, and monitoring integration.",
      tech: ["Jenkins", "GitLab", "Ansible", "Prometheus"],
      status: "DEPLOYED",
    },
    {
      title: "Blockchain Integration",
      description: "Secure blockchain-based transaction system with smart contract implementation.",
      tech: ["Solidity", "Web3.js", "Ethereum", "IPFS"],
      status: "BETA",
    },
    {
      title: "IoT Management Platform",
      description: "Comprehensive IoT device management with real-time monitoring and control capabilities.",
      tech: ["MQTT", "InfluxDB", "Grafana", "Go"],
      status: "ACTIVE",
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
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-white group-hover:text-pink-400 transition-colors duration-300">
                    {project.title}
                  </h3>
                  <span
                    className={`px-2 py-1 text-xs font-mono rounded ${
                      project.status === "ACTIVE"
                        ? "bg-green-500/20 text-green-400"
                        : project.status === "DEPLOYED"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-yellow-500/20 text-yellow-400"
                    }`}
                  >
                    {project.status}
                  </span>
                </div>

                <p className="text-gray-300 text-sm mb-4 leading-relaxed">{project.description}</p>

                <div className="flex flex-wrap gap-2 mb-4">
                  {project.tech.map((tech) => (
                    <span key={tech} className="px-2 py-1 text-xs bg-violet-500/20 text-violet-300 rounded font-mono">
                      {tech}
                    </span>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full bg-transparent border-pink-500/30 text-pink-400 hover:bg-pink-500/10 hover:border-pink-500/50"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  VIEW PROJECT
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default ProjectsSection


