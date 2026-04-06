import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Manutencao, ManutencaoInsert, Equipamento, Protocolo, TarefaProtocolo } from '../lib/database.types'
import toast from 'react-hot-toast'

export type ManutencaoWithRelations = Manutencao & {
  equipamentos: (Equipamento & { 
    categorias: { 
      nome: string; 
      protocolos?: Array<{ 
        id: string; 
        titulo: string; 
        tarefas_protocolo: Array<{ id: string; descricao: string; ordem: number }> 
      }> 
    } | null 
  }) | null
  protocolos: { titulo: string; periodicidade: string; tarefas_protocolo?: { id: string; descricao: string; ordem: number }[] } | null
  profiles: { nome: string; email: string } | null
  evidencias: Array<{ id: string; foto_url: string }>
}

export function useManutencoes() {
  return useQuery({
    queryKey: ['manutencoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('manutencoes')
        .select(`
          *,
          equipamentos(
            id, nome, patrimonio, categoria_id, 
            categorias(
              nome,
              protocolos(id, titulo, tarefas_protocolo(id, descricao, ordem))
            )
          ),
          protocolos(titulo, periodicidade, tarefas_protocolo(id, descricao, ordem)),
          profiles(nome, email),
          evidencias(id, foto_url)
        `)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as ManutencaoWithRelations[]
    },
  })
}

export function useCreateManutencao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (m: ManutencaoInsert) => {
      const { data, error } = await supabase.from('manutencoes').insert(m as Record<string, unknown>).select().single()
      if (error) throw error
      return data as Manutencao
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manutencoes'] })
      toast.success('Manutenção registrada!')
    },
    onError: () => toast.error('Erro ao registrar manutenção'),
  })
}

export function useUpdateManutencao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, unknown>) => {
      const { error } = await supabase.from('manutencoes').update(updates).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manutencoes'] })
      toast.success('Manutenção atualizada!')
    },
    onError: () => toast.error('Erro ao atualizar manutenção'),
  })
}

export function useDeleteManutencao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('manutencoes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manutencoes'] })
      toast.success('Manutenção deletada com sucesso!')
    },
    onError: () => toast.error('Erro ao deletar manutenção'),
  })
}

export function useAddEvidencia() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ manutencao_id, foto_url }: { manutencao_id: string; foto_url: string }) => {
      const { error } = await supabase.from('evidencias').insert({ manutencao_id, foto_url } as Record<string, unknown>)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manutencoes'] })
    },
  })
}

export type AgendaProtocolo = Protocolo & {
  categorias: { nome: string } | null
  tarefas_protocolo: TarefaProtocolo[]
}

export function useAgenda() {
  return useQuery({
    queryKey: ['agenda'],
    queryFn: async () => {
      const { data: protocolos, error } = await supabase
        .from('protocolos')
        .select('*, categorias(nome), tarefas_protocolo(id, descricao, ordem)')
        .eq('status', 'ativo')
      if (error) throw error

      const { data: equipamentos } = await supabase
        .from('equipamentos')
        .select('*, categorias(nome)')
        .eq('status', 'ativo')

      return {
        protocolos: (protocolos ?? []) as AgendaProtocolo[],
        equipamentos: (equipamentos ?? []) as Equipamento[],
      }
    },
  })
}
