import React, { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react'
import { api } from '../../lib/api'
import { getImageUrl, cn } from '../../lib/utils'
import { useToast } from '../../hooks/use-toast'

interface ImageUploadProps {
  label: string
  value?: string | null // image key
  onChange: (key: string | null) => void
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export default function ImageUpload({ label, value, onChange }: ImageUploadProps) {
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const imageUrl = getImageUrl(value)

  const handleFile = async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type) && !file.name.toLowerCase().endsWith('.heic')) {
      toast({ title: 'Formato inválido', description: 'Aceito: JPEG, PNG, WebP, HEIC', variant: 'destructive' })
      return
    }
    if (file.size > MAX_SIZE) {
      toast({ title: 'Arquivo muito grande', description: 'Máximo 10MB', variant: 'destructive' })
      return
    }

    setIsUploading(true)
    setProgress(20)
    try {
      // Simula progresso
      const progressInterval = setInterval(() => {
        setProgress((p) => Math.min(p + 10, 90))
      }, 200)

      const res = await api.upload.image(file)
      clearInterval(progressInterval)
      setProgress(100)
      onChange(res.key)
    } catch (err: unknown) {
      toast({
        title: 'Erro ao fazer upload',
        description: err instanceof Error ? err.message : 'Tente novamente',
        variant: 'destructive',
      })
    } finally {
      setTimeout(() => {
        setIsUploading(false)
        setProgress(0)
      }, 500)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // Limpa input para permitir reselecionar o mesmo arquivo
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
  }

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      <div
        onClick={() => !isUploading && !imageUrl && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'relative rounded-xl border-2 border-dashed transition-colors overflow-hidden',
          'aspect-square flex flex-col items-center justify-center',
          isDragging ? 'border-primary bg-primary/5' : 'border-border',
          !imageUrl && !isUploading ? 'cursor-pointer hover:border-primary hover:bg-accent/50' : '',
          imageUrl ? 'border-solid border-border' : ''
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,.heic"
          onChange={handleInputChange}
          className="hidden"
        />

        <AnimatePresence mode="wait">
          {isUploading ? (
            <motion.div
              key="uploading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 p-4"
            >
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <div className="w-full max-w-[120px] bg-muted rounded-full h-1.5 overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.2 }}
                />
              </div>
              <p className="text-xs text-muted-foreground">Enviando...</p>
            </motion.div>
          ) : imageUrl ? (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full relative group"
            >
              <img
                src={imageUrl}
                alt={label}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="bg-white/20 hover:bg-white/30 text-white rounded-full p-2 backdrop-blur-sm transition-colors"
                >
                  <ImageIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="bg-red-500/70 hover:bg-red-500 text-white rounded-full p-2 backdrop-blur-sm transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-2 p-4 text-center"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Clique ou arraste a imagem
              </p>
              <p className="text-[10px] text-muted-foreground/70">
                JPEG, PNG, WebP, HEIC (máx 10MB)
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
