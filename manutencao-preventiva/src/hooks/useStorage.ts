import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export function useStorage(bucket: string) {
  const [uploading, setUploading] = useState(false)

  const upload = useCallback(async (file: File, folder?: string): Promise<string | null> => {
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const fileName = `${folder ? folder + '/' : ''}${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { error } = await supabase.storage.from(bucket).upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      })

      if (error) throw error

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName)
      return urlData.publicUrl
    } catch {
      toast.error('Erro no upload da imagem')
      return null
    } finally {
      setUploading(false)
    }
  }, [bucket])

  const uploadMultiple = useCallback(async (files: File[], folder?: string): Promise<string[]> => {
    const urls: string[] = []
    for (const file of files) {
      const url = await upload(file, folder)
      if (url) urls.push(url)
    }
    return urls
  }, [upload])

  return { upload, uploadMultiple, uploading }
}
