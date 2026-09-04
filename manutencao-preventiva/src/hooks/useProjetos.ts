import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Projeto, ProjetoInsert, ProjetoUpdate } from '../lib/database.types'
import toast from 'react-hot-toast'

export function useProjetos() {
  return useQuery({
    queryKey: ['projetos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projetos')
        .select('*')
        .order('data_inicio', { ascending: false })

      if (error) {
        // Se a tabela ainda não foi criada no Supabase, retorna lista vazia e avisa amigavelmente
        if (error.code === '42P01' || error.message.includes('relation "public.projetos" does not exist')) {
          console.warn('Tabela projetos ainda não criada no Supabase.')
          return [] as Projeto[]
        }
        throw error
      }
      return (data ?? []) as Projeto[]
    },
  })
}

export function useCreateProjeto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: ProjetoInsert) => {
      const { data, error } = await supabase
        .from('projetos')
        .insert(p as Record<string, unknown>)
        .select()
        .single()

      if (error) throw error
      return data as Projeto
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projetos'] })
      toast.success('Projeto registrado com sucesso!')
    },
    onError: (err: any) => {
      console.error(err)
      toast.error('Erro ao cadastrar projeto. Verifique a tabela no banco.')
    },
  })
}

export function useUpdateProjeto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & ProjetoUpdate) => {
      const { error } = await supabase
        .from('projetos')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projetos'] })
      toast.success('Projeto atualizado com sucesso!')
    },
    onError: () => toast.error('Erro ao atualizar projeto'),
  })
}

export function useDeleteProjeto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projetos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projetos'] })
      toast.success('Projeto excluído com sucesso!')
    },
    onError: () => toast.error('Erro ao excluir projeto'),
  })
}
