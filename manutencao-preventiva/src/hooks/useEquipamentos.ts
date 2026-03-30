import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Equipamento, EquipamentoInsert } from '../lib/database.types'
import toast from 'react-hot-toast'

export function useEquipamentos() {
  return useQuery({
    queryKey: ['equipamentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipamentos')
        .select('*, categorias(nome)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as (Equipamento & { categorias: { nome: string } | null })[]
    },
  })
}

export function useCreateEquipamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (eq: EquipamentoInsert) => {
      const { data, error } = await supabase.from('equipamentos').insert(eq as Record<string, unknown>).select().single()
      if (error) throw error
      return data as Equipamento
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['equipamentos'] })
      toast.success('Equipamento criado!')
    },
    onError: () => toast.error('Erro ao criar equipamento'),
  })
}

export function useUpdateEquipamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, unknown>) => {
      const { data, error } = await supabase.from('equipamentos').update(updates).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['equipamentos'] })
      toast.success('Equipamento atualizado!')
    },
    onError: () => toast.error('Erro ao atualizar equipamento'),
  })
}

export function useDeleteEquipamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('equipamentos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['equipamentos'] })
      toast.success('Equipamento excluído!')
    },
    onError: () => toast.error('Erro ao excluir equipamento'),
  })
}
