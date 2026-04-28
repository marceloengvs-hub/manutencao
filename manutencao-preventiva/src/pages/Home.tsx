import { Link } from 'react-router-dom'
import { Wrench, PackageSearch, Calculator, LogOut, Building2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import BrandIcon from '../components/BrandIcon'

export default function Home() {
  const { signOut } = useAuth()

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-surface-main)' }}>
      {/* Navbar Minimalista */}
      <header className="px-6 py-4 flex justify-between items-center border-b border-white/5" style={{ background: 'var(--color-surface-panel)' }}>
        <div className="flex items-center gap-3">
          <BrandIcon size={32} />
          <h1 className="font-bold text-lg" style={{ color: 'var(--color-text-heading)' }}>IPElab MAN</h1>
        </div>
        <button 
          onClick={signOut}
          className="btn-ghost text-sm px-3 py-1.5 flex items-center gap-2"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <LogOut size={16} />
          Sair
        </button>
      </header>

      {/* Área Principal */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12">
        <div className="text-center mb-12 animate-slide-up">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3" style={{ color: 'var(--color-text-heading)' }}>
            Portal de Módulos
          </h2>
          <p className="text-base sm:text-lg max-w-xl mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
            Selecione o módulo que deseja acessar para gerenciar as operações do laboratório.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl w-full mx-auto">
          
          {/* Card: Manutenção */}
          <Link 
            to="/dashboard" 
            className="group relative rounded-xl p-10 transition-all duration-300 hover:-translate-y-1 flex flex-col items-center text-center overflow-hidden animate-fade-in"
            style={{ 
              background: 'var(--color-surface-panel)', 
              border: '1px solid var(--color-border-default)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
            }}
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none" style={{ background: 'var(--color-accent)' }} />
            <div 
              className="w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110"
              style={{ background: 'var(--color-accent-muted)', color: 'var(--color-accent)' }}
            >
              <Wrench size={40} />
            </div>
            <h3 className="text-2xl font-bold mb-3" style={{ color: 'var(--color-text-heading)' }}>Manutenção</h3>
            <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
              Gestão de preventivas, corretivas, equipamentos e agenda do laboratório.
            </p>
          </Link>

          {/* Card: Insumos (Em Construção) */}
          <div 
            className="relative rounded-xl p-10 flex flex-col items-center text-center overflow-hidden opacity-60 animate-fade-in"
            style={{ 
              background: 'var(--color-surface-panel)', 
              border: '1px solid var(--color-border-default)',
              animationDelay: '100ms'
            }}
          >
            <div className="absolute top-4 right-4">
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
                Em Construção
              </span>
            </div>
            <div 
              className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--color-text-muted)' }}
            >
              <PackageSearch size={40} />
            </div>
            <h3 className="text-2xl font-bold mb-3" style={{ color: 'var(--color-text-heading)' }}>Insumos</h3>
            <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
              Controle de estoque, materiais consumíveis e rastreio de uso.
            </p>
          </div>

          {/* Card: Orçamentos (Em Construção) */}
          <div 
            className="relative rounded-xl p-10 flex flex-col items-center text-center overflow-hidden opacity-60 animate-fade-in"
            style={{ 
              background: 'var(--color-surface-panel)', 
              border: '1px solid var(--color-border-default)',
              animationDelay: '200ms'
            }}
          >
            <div className="absolute top-4 right-4">
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
                Em Construção
              </span>
            </div>
            <div 
              className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--color-text-muted)' }}
            >
              <Calculator size={40} />
            </div>
            <h3 className="text-2xl font-bold mb-3" style={{ color: 'var(--color-text-heading)' }}>Orçamentos</h3>
            <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
              Cálculo de custos de serviços, peças e simulações para usuários.
            </p>
          </div>

          {/* Card: Unidades (Em Construção) */}
          <div 
            className="relative rounded-xl p-10 flex flex-col items-center text-center overflow-hidden opacity-60 animate-fade-in"
            style={{ 
              background: 'var(--color-surface-panel)', 
              border: '1px solid var(--color-border-default)',
              animationDelay: '300ms'
            }}
          >
            <div className="absolute top-4 right-4">
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
                Em Construção
              </span>
            </div>
            <div 
              className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--color-text-muted)' }}
            >
              <Building2 size={40} />
            </div>
            <h3 className="text-2xl font-bold mb-3" style={{ color: 'var(--color-text-heading)' }}>Unidades</h3>
            <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
              Gestão de laboratórios parceiros, permissões e filiais do IPElab.
            </p>
          </div>

        </div>
      </main>
    </div>
  )
}
