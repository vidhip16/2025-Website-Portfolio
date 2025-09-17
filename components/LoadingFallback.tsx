"use client"

import { motion } from "framer-motion"
import { Loader2 } from "lucide-react"

interface LoadingFallbackProps {
  message?: string
}

export function LoadingFallback({ message = "Loading..." }: LoadingFallbackProps) {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 mx-auto mb-4"
        >
          <Loader2 className="w-12 h-12 text-pink-400" />
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-gray-300 font-mono"
        >
          {message}
        </motion.p>
      </motion.div>
    </div>
  )
}

interface ErrorFallbackProps {
  error?: Error
  resetError?: () => void
}

export function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-md"
      >
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-2xl font-bold text-pink-400 mb-4">Something went wrong</h2>
        <p className="text-gray-300 mb-6">
          {error?.message || "An unexpected error occurred. Please try refreshing the page."}
        </p>
        {resetError && (
          <button
            onClick={resetError}
            className="px-6 py-2 bg-gradient-to-r from-pink-500 to-violet-500 text-white rounded-lg hover:from-pink-600 hover:to-violet-600 transition-all duration-300"
          >
            Try Again
          </button>
        )}
      </motion.div>
    </div>
  )
}
