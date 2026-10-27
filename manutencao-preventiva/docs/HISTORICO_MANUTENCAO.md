# Histórico e Diretrizes de Manutenção - IPElab MAN

> **Documento de Contexto Persistente**  
> Criado em: 27 de Outubro de 2026  
> Projeto: [manutencao-five.vercel.app](https://manutencao-five.vercel.app/)  
> Repositório: `manutencao-repo/manutencao-preventiva`

---

## 1. Visão Geral do Sistema
O **IPElab MAN** é a plataforma de gestão de manutenção preventiva, corretiva e controle operacional dos equipamentos de fabricação digital do laboratório (IPElab/UFG). A aplicação foi desenvolvida em **React + Vite + TypeScript + Tailwind CSS** integrada ao **Supabase** (PostgreSQL + RLS + Storage) e hospedada na **Vercel**.

---

## 2. Diagnóstico Realizado em Outubro/2026

Durante a inspeção dos equipamentos e protocolos cadastrados, foram identificadas as seguintes necessidades:

1. **Inconsistências de Conteúdo Técnico nos Protocolos:**
   - **Cruzamento FDM x Resina:** Um protocolo de tecnologia FDM (*"Preventiva Semanal - Impressoras 3D FDM"* com tarefas de bico, correias e hotend) estava vinculado à impressora de resina MSLA `Creality LD-002H`.
   - **Título Incompatível em CNC:** Os protocolos da `Fresadora CNC Router FCR3000` foram salvos com o título *"Fibra de corte à laser - FCR 3000"*, gerando confusão operacional entre as tecnologias de Laser e Fresagem de madeira/MDF.
   - **Periodicidade Divergente:** O protocolo *"Preventiva Mensal - Creality Halot Mage"* estava configurado internamente com periodicidade semanal no banco de dados.

2. **Equipamentos e Patrimônios:**
   - Alguns equipamentos possuem códigos de patrimônio oficiais (ex: `IPELAB-ROUTER-01`, `IPELAB-MDX50-01`), enquanto outros utilizavam valores provisórios (`123`, `1234`, `321`).
   - **Decisão do Usuário:** **Nenhum equipamento deve ser excluído**. Todos os registros representam máquinas físicas ativas e os números de patrimônio definitivos serão atualizados manualmente pelo responsável no laboratório.

3. **Novas Máquinas sem Checklist Preventivo:**
   - A impressora de resina **Elegoo Saturn 4 Ultra 16K** e a estação de cura/lavagem **Elegoo Mercury Plus V3.0** precisavam de protocolos dedicados sob medida.

---

## 3. Modificações e Soluções Implementadas

### A. Correção na Deduplicação da Agenda (`src/utils/maintenance.ts`)
- **Problema anterior:** A chave de deduplicação utilizava apenas `${item.equipamentoId}::${item.nextDate.getTime()}`. Se uma manutenção preventiva semanal e uma mensal coincidissem na mesma data para o mesmo ativo, uma delas era omitida.
- **Ajuste:** A chave foi expandida para incluir o título do protocolo:
  ```ts
  const key = `${item.equipamentoId}::${item.titulo.toLowerCase().trim()}::${item.nextDate.getTime()}`;
  ```
  Isso garante que rotinas semanais e mensais programadas para o mesmo dia sejam exibidas aos técnicos.

### B. Assistente de Saneamento Inteligente (`src/pages/Protocolos.tsx`)
- Implementado um assistente dinâmico no topo da tela de Protocolos (`/protocolos`):
  - **Detector de Incompatibilidades:** Identifica cruzamentos de tecnologias e nomenclaturas errôneas com ação de correção/exclusão em 1 clique.
  - **Correção de Periodicidade:** Identifica discrepâncias entre o título do protocolo e a periodicidade cadastrada.
  - **Gerador Sob Medida:** Botão *"Gerar Sob Medida"* que cria automaticamente os checklists recomendados (semanal e mensal) para máquinas ativas desprovidas de protocolos (como a Saturn 4 Ultra e Mercury Plus).
  - **Sanar em Massa:** Botão *"Sanar Inconsistências"* para resolver todas as pendências de uma única vez com a sessão autenticada do usuário.

### C. Script SQL de Padronização Complementar (`supabase/saneamento_protocolos.sql`)
- Script transacional (`BEGIN ... COMMIT`) pronto para ser executado no SQL Editor do Supabase se o administrador preferir aplicar o saneamento direto no banco de dados.

---

## 4. Mapeamento de Equipamentos do Laboratório

| Equipamento / Modelo | Categoria | Tecnologia | Protocolos Necessários |
| :--- | :--- | :--- | :--- |
| **Fibra de corte a Laser P3015 1500W** | Corte a Laser | Laser Fibra Óptica Industrial | Semanal (Óptico/Chiller) + Mensal (Guias/Estrutura) |
| **Cortadora Laser Delta CNC** | Corte a Laser | CO2 Laser | Semanal (Espelhos/Foco) + Mensal (Tubo CO2/Exaustor) |
| **Cortadora Laser Duplotech 1080** | Corte a Laser | CO2 Laser | Semanal (Alinhamento óptico) + Mensal (Chiller/Correias) |
| **CNC Router FCR 3000** | CNC Router | Fresadora Router 3 Eixos | Semanal (Cavacos/Spindle) + Mensal (Cremalheiras/MDF) |
| **Roland MODELA MDX-50** | Fresadora CNC | Fresadora CNC de Precisão | Semanal (ATC/Pinça) + Mensal (Fusos Z/4º Eixo) |
| **Elegoo Saturn 4 Ultra 16K** | Impressora 3D Resina | MSLA Resina UV | Semanal (Tanque/FEP/LCD) + Mensal (Tilt-Release/Z) |
| **Elegoo Mercury Plus V3.0** | Outro | Lavadora e Curadora UV | Semanal (Solvente/Rotor) + Mensal (LEDs UV/Câmara) |
| **Creality Halot Mage** | Impressora 3D Resina | MSLA Resina UV | Semanal (Painel 8K/Tanque) + Mensal (Fuso Z/Filtro) |
| **Creality LD-002 / LD-002H** | Impressora 3D Resina | MSLA Resina UV | Semanal (FEP/Mesa) + Mensal (Fuso Z/Nivelamento) |
| **Creality LD-006** | Impressora 3D Resina | MSLA Resina UV | Semanal (Tanque/LCD) + Mensal (Guias Z/Filtro) |
| **Creality CR-30** | Impressora 3D FDM | FDM Esteira Contínua | Semanal (Esteira/Gantry 45°) + Mensal (Roletes/Tração) |
| **Creality CR-X** | Impressora 3D FDM | FDM Extrusão Dupla | Semanal (Bico 2-em-1) + Mensal (V-Slot/Fuso Z) |
| **Creality Ender-3 S1** | Impressora 3D FDM | FDM Direct Sprite | Semanal (Bico/CR-Touch) + Mensal (Roldanas/Exaustor) |
| **Creality K1 / K1 Max** | Impressora 3D FDM | FDM CoreXY Alta Velocidade | Semanal (Hotend/PEI) + Mensal (Extrusora/Resonância) |
| **FlashForge AD5X** | Impressora 3D FDM | FDM CoreXY Multi-Cores | Semanal (Bicos/Mesa) + Mensal (Calibração/Guias) |

---

## 5. Roteiro para Próximas Atualizações

1. **Atualização dos Patrimônios:**
   - Acessar o menu **Equipamentos** (`/equipamentos`).
   - Clicar em **Editar** nos equipamentos que estão com números provisórios (`123`, etc.) e inserir os números de patrimônio oficiais do laboratório.
2. **Execução do Saneamento de Protocolos:**
   - Acessar o menu **Protocolos** (`/protocolos`).
   - Clicar no botão **Saneamento** no cabeçalho e confirmar o saneamento para limpar as inconsistências e gerar os protocolos sob medida das máquinas novas.
3. **Novas Demandas:**
   - Ao iniciar qualquer nova sessão com o assistente de IA, mencione este arquivo para que o contexto histórico seja carregado imediatamente.
