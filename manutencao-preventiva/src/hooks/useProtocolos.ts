import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Protocolo, Categoria, TarefaProtocolo } from '../lib/database.types'
import toast from 'react-hot-toast'

export type ProtocoloWithRelations = Protocolo & {
  categorias: { nome: string } | null
  tarefas_protocolo: TarefaProtocolo[]
}

export function useProtocolos() {
  return useQuery({
    queryKey: ['protocolos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('protocolos')
        .select('*, categorias(nome), tarefas_protocolo(id, descricao, ordem)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as ProtocoloWithRelations[]
    },
  })
}

interface CreateProtocoloInput {
  titulo: string
  categoria_id: string | null
  equipamento_id: string | null
  periodicidade: 'diaria' | 'semanal' | 'mensal'
  status?: string
  data_inicio: string
  user_id: string
  tarefas: string[]
}

export function useCreateProtocolo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ tarefas, ...proto }: CreateProtocoloInput) => {
      const { data, error } = await supabase.from('protocolos').insert(proto as Record<string, unknown>).select().single()
      if (error) throw error

      const inserted = data as Protocolo
      if (tarefas.length > 0) {
        const rows = tarefas.map((desc, i) => ({
          protocolo_id: inserted.id,
          descricao: desc,
          ordem: i,
        }))
        const { error: tErr } = await supabase.from('tarefas_protocolo').insert(rows as Record<string, unknown>[])
        if (tErr) throw tErr
      }
      return inserted
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['protocolos'] })
      qc.invalidateQueries({ queryKey: ['agenda'] })
      toast.success('Protocolo criado!')
    },
    onError: () => toast.error('Erro ao criar protocolo'),
  })
}

interface UpdateProtocoloInput {
  id: string
  titulo?: string
  categoria_id?: string | null
  equipamento_id?: string | null
  periodicidade?: string
  status?: string
  data_inicio?: string
  tarefas?: Array<{ id?: string; descricao: string }>
}

export function useUpdateProtocolo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, tarefas, ...updates }: UpdateProtocoloInput) => {
      const { error } = await supabase.from('protocolos').update(updates as Record<string, unknown>).eq('id', id)
      if (error) throw error

      if (tarefas) {
        // 1. Buscar IDs atuais no banco
        const { data: currentTasks } = await supabase
          .from('tarefas_protocolo')
          .select('id')
          .eq('protocolo_id', id)
        
        const currentIds = (currentTasks ?? []).map(t => t.id)
        const incomingIds = tarefas.filter(t => t.id).map(t => t.id!)

        // 2. Deletar tarefas que não estão na nova lista
        const toDelete = currentIds.filter(cid => !incomingIds.includes(cid))
        if (toDelete.length > 0) {
          await supabase.from('tarefas_protocolo').delete().in('id', toDelete)
        }

        // 3. Upsert das tarefas (as que tem ID atualizam, as sem ID inserem)
        if (tarefas.length > 0) {
          const rows = tarefas.map((t, i) => ({
            ...(t.id ? { id: t.id } : {}),
            protocolo_id: id,
            descricao: t.descricao,
            ordem: i,
          }))

          const { error: tErr } = await supabase.from('tarefas_protocolo').upsert(rows as Record<string, unknown>[])
          if (tErr) throw tErr
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['protocolos'] })
      qc.invalidateQueries({ queryKey: ['agenda'] })
      toast.success('Protocolo atualizado!')
    },
    onError: () => toast.error('Erro ao atualizar protocolo'),
  })
}

export function useDeleteProtocolo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('protocolos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['protocolos'] })
      qc.invalidateQueries({ queryKey: ['agenda'] })
      toast.success('Protocolo excluído!')
    },
    onError: () => toast.error('Erro ao excluir protocolo'),
  })
}

export function useCategorias() {
  return useQuery({
    queryKey: ['categorias'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categorias').select('*').order('nome')
      if (error) throw error
      return (data ?? []) as Categoria[]
    },
  })
}

export function useCreateCategoria() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (nome: string) => {
      const { data, error } = await supabase.from('categorias').insert({ nome } as Record<string, unknown>).select().single()
      if (error) throw error
      return data as Categoria
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categorias'] })
      toast.success('Categoria criada!')
    },
    onError: () => toast.error('Erro ao criar categoria'),
  })
}
