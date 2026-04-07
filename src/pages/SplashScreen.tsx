import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Coins } from 'lucide-react'

export default function SplashScreen() {
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/feed', { replace: true })
    }, 2500)
    return () => clearTimeout(timer)
  }, [navigate])

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-yellow-50 via-amber-50 to-yellow-100 dark:from-yellow-950/30 dark:via-amber-950/20 dark:to-background">
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, duration: 0.8 }}
        className="flex flex-col items-center gap-6"
      >
        {/* Ícone animado */}
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          className="relative"
        >
          <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl scale-150" />
          <div className="relative bg-primary/10 border-2 border-primary/30 rounded-full p-6">
            <Coins className="h-16 w-16 text-primary" />
          </div>
        </motion.div>

        {/* Nome do app */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="text-center"
        >
          <h1 className="text-5xl font-bold text-foreground">
            Coin<span className="text-primary">Hub</span>
          </h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="mt-2 text-muted-foreground text-lg"
          >
            Sua coleção, seu patrimônio
          </motion.p>
        </motion.div>

        {/* Indicador de loading */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="flex gap-1.5 mt-4"
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
              className="w-2 h-2 rounded-full bg-primary"
            />
          ))}
        </motion.div>
      </motion.div>
    </div>
  )
}
