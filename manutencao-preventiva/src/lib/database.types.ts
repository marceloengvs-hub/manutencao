export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          nome: string
          email: string
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id: string
          nome: string
          email: string
          avatar_url?: string | null
        }
        Update: {
          nome?: string
          avatar_url?: string | null
        }
      }
      categorias: {
        Row: {
          id: string
          nome: string
          created_at: string
        }
        Insert: {
          nome: string
        }
        Update: {
          nome?: string
        }
      }
      equipamentos: {
        Row: {
          id: string
          nome: string
          modelo: string
          categoria_id: string | null
          patrimonio: string
          descricao: string | null
          foto_url: string | null
          status: 'ativo' | 'inativo' | 'manutencao'
          created_at: string
          user_id: string
        }
        Insert: {
          nome: string
          modelo: string
          categoria_id?: string | null
          patrimonio: string
          descricao?: string | null
          foto_url?: string | null
          status?: 'ativo' | 'inativo' | 'manutencao'
          user_id: string
        }
        Update: {
          nome?: string
          modelo?: string
          categoria_id?: string | null
          patrimonio?: string
          descricao?: string | null
          foto_url?: string | null
          status?: 'ativo' | 'inativo' | 'manutencao'
        }
      }
      protocolos: {
        Row: {
          id: string
          titulo: string
          categoria_id: string | null
          equipamento_id: string | null
          periodicidade: 'diaria' | 'semanal' | 'mensal'
          status: 'ativo' | 'inativo'
          data_inicio: string
          created_at: string
          user_id: string
        }
        Insert: {
          titulo: string
          categoria_id?: string | null
          equipamento_id?: string | null
          periodicidade: 'diaria' | 'semanal' | 'mensal'
          status?: 'ativo' | 'inativo'
          data_inicio: string
          user_id: string
        }
        Update: {
          titulo?: string
          categoria_id?: string | null
          equipamento_id?: string | null
          periodicidade?: 'diaria' | 'semanal' | 'mensal'
          status?: 'ativo' | 'inativo'
          data_inicio?: string
        }
      }
      tarefas_protocolo: {
        Row: {
          id: string
          protocolo_id: string
          descricao: string
          ordem: number
        }
        Insert: {
          protocolo_id: string
          descricao: string
          ordem: number
        }
        Update: {
          descricao?: string
          ordem?: number
        }
      }
      manutencoes: {
        Row: {
          id: string
          equipamento_id: string
          protocolo_id: string | null
          tipo: 'preventiva' | 'corretiva'
          titulo: string
          status: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada'
          tecnico_id: string
          checklist_json: Record<string, boolean | { concluida: boolean; descricao: string }> | null
          observacoes: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          equipamento_id: string
          protocolo_id?: string | null
          tipo: 'preventiva' | 'corretiva'
          titulo: string
          status?: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada'
          tecnico_id: string
          checklist_json?: Record<string, boolean | { concluida: boolean; descricao: string }> | null
          observacoes?: string | null
          completed_at?: string | null
        }
        Update: {
          status?: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada'
          checklist_json?: Record<string, boolean | { concluida: boolean; descricao: string }> | null
          observacoes?: string | null
          completed_at?: string | null
        }
      }
      evidencias: {
        Row: {
          id: string
          manutencao_id: string
          foto_url: string
          created_at: string
        }
        Insert: {
          manutencao_id: string
          foto_url: string
        }
        Update: Record<string, never>
      }
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Categoria = Database['public']['Tables']['categorias']['Row']
export type Equipamento = Database['public']['Tables']['equipamentos']['Row']
export type EquipamentoInsert = Database['public']['Tables']['equipamentos']['Insert']
export type Protocolo = Database['public']['Tables']['protocolos']['Row']
export type ProtocoloInsert = Database['public']['Tables']['protocolos']['Insert']
export type TarefaProtocolo = Database['public']['Tables']['tarefas_protocolo']['Row']
export type TarefaProtocoloInsert = Database['public']['Tables']['tarefas_protocolo']['Insert']
export type Manutencao = Database['public']['Tables']['manutencoes']['Row']
export type ManutencaoInsert = Database['public']['Tables']['manutencoes']['Insert']
export type Evidencia = Database['public']['Tables']['evidencias']['Row']
