# GameBank - Documentação de Desenvolvimento

## Visão Geral do Projeto

GameBank é um gerenciador de partidas do tabuleiro Super Banco Imobiliário, desenvolvido com Next.js 14+ (App Router), TypeScript e Tailwind CSS.

---

## Tema e Estilização

### Tema Escuro (Dark Theme)

O projeto utiliza **exclusivamente tema escuro** em todas as páginas e componentes.

**Paleta de cores principal:**
- Background: `zinc-950` / `zinc-900`
- Bordas: `zinc-700` / `zinc-800`
- Textos principais: `zinc-100` / `zinc-200`
- Textos secundários: `zinc-400` / `zinc-500`
- Accents: Purple (`purple-400`, `purple-500`, `purple-600`) e Green (`green-400`, `green-500`)

**Como ativar o tema dark:**
```tsx
// Em layout.tsx (raiz)
<html lang="en" className="dark">...</html>
```

As classes Tailwind com prefixo `dark:` são usadas para variantes dark (ex: `dark:bg-zinc-800`), mas o tema global já está ativo via classe no HTML.

---

## Padronização de Fontes

O projeto utiliza duas fontes do Google Fonts configuradas no `layout.tsx`:

### Jaro (Títulos e Subtítulos)
- Uso: Títulos principais, headers, nomes de sessões
- Aplicação via classe `font-jaro`

```tsx
// Exemplos de uso
<h1 className="text-3xl font-jaro font-bold text-zinc-100">Título</h1>
<h2 className="text-xl font-jaro text-zinc-200">Subtítulo</h2>
```

### Inconsolata (Demais текст)
- Uso: Textos corridos, descrições, valores, labels
- Aplicação via classe `font-inconsolata`

```tsx
// Exemplos de uso
<p className="text-sm font-inconsolata text-zinc-400">Descrição</p>
<span className="font-inconsolata">Valor: R$ 1.000,00</span>
```

**Configuração no layout.tsx:**
```tsx
import { Jaro, Inconsolata } from 'next/font/google'

const jaro = Jaro({ subsets: ['latin'] })
const inconsolata = Inconsolata({ subsets: ['latin'] })

// No return do layout:
<html className={`dark ${jaro.className} ${inconsolata.className}`}>
```

---

## Componentes Personalizados

### Button01 (Botão Neon/Pixel)

Botão customizado com estilo neon/pixel, localizado em `src/components/Button01/index.tsx`.

**Propriedades:**
```tsx
interface Button01Props {
  children?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  color?: 'green' | 'red' | 'blue' | 'purple' | 'yellow'
  handle: () => void
  disabled?: boolean
  className?: string
  type?: 'button' | 'submit'
}
```

**Uso:**
```tsx
import Button1 from "@/components/Button01"

<Button1 size="md" color="green" handle={() => console.log('click')}>
  Texto do Botão
</Button1>
```

**Cores disponíveis:**
- `green` - verde neon
- `red` - vermelho neon
- `blue` - azul
- `purple` - roxo neon
- `yellow` - amarelo

### ToastProvider (Toasts Customizados)

Sistema de notificações toast com tema dark, localizado em `src/components/Toast/ToastProvider.tsx`.

**Uso:**
```tsx
import { useToast } from "@/components/Toast"

export default function MeuComponente() {
  const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast()

  // Para mostrar toasts:
  toastSuccess("Operação realizada com sucesso!")
  toastError("Ocorreu um erro")
  toastWarning("Atenção!")
}
```

**Características:**
- Tema dark com bordas coloridas
- Tipos: success (verde), error (vermelho), warning (âmbar), info (azul)
- Tempo de exibição: 4 segundos
- Botão para fechar manualmente

### Modal (GSAP)

Modal com animações GSAP e tema dark, localizado em `src/components/Modal/index.tsx`.

**Props:**
```tsx
interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  children: React.ReactNode
}
```

**Uso:**
```tsx
import Modal from "@/components/Modal"

<Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Título">
  <p>Conteúdo do modal</p>
</Modal>
```

### ConfirmationModal

Modal de confirmação com tema dark, localizado em `src/components/ConfirmationModal/index.tsx`.

### PropertyCard

Card para exibição de propriedades, localizado em `src/components/PropertyCard/index.tsx`.

---

## Bibliotecas e Dependências Principais

### Core
- **Next.js 14+** - Framework React com App Router
- **React 18+** - Biblioteca UI
- **TypeScript** - Tipagem estática

### Estilização
- **Tailwind CSS** - Framework de CSS utilitário
- **@tailwindcss/animate** - Animações CSS
- **clsx** e **tailwind-merge** - Utilitários para classes

### Componentes UI (Radix UI)
- `@radix-ui/react-select` - Selects dropdown
- `@radix-ui/react-dialog` - Modals
- `@radix-ui/react-dropdown-menu` - Menus dropdown

### Animações
- **GSAP** - Animações avançadas (usado no Modal)
- **Framer Motion** - Animações (originalmente usado no Modal, substituído por GSAP)

### Ícones
- **Lucide React** - Ícones modernos
- **@fortawesome/react-fontawesome** - Ícones diversos (brands, etc)

### Formulários
- **React Hook Form** - Gerenciamento de formulários
- **Zod** - Validação de esquemas

### Outras
- **Lenis** - Smooth scroll
- **howler** - Reprodução de áudio
- **date-fns** - Manipulação de datas

---

## Estrutura de Diretórios

```
client/src/
├── app/                      # Páginas Next.js (App Router)
│   ├── layout.tsx            # Layout raiz (fonts, ToastProvider)
│   ├── page.tsx              # Homepage
│   ├── sessions/             # Lista de sessões
│   ├── new-session/         # Criar nova sessão
│   ├── game/[sessionId]/    # Jogo em andamento
│   ├── arquivados/          # Sessões arquivadas
│   └── globals.css           # Estilos globais + variáveis theme
│
├── components/               # Componentes React
│   ├── Button01/            # Botão neon/pixel
│   ├── Toast/               # Sistema de toasts
│   ├── Modal/               # Modal GSAP
│   ├── ConfirmationModal/   # Modal de confirmação
│   ├── PropertyCard/        # Card de propriedade
│   ├── PlayerCard/          # Card de jogador
│   ├── Banco/               # Aba Banco
│   ├── Especiais/           # Aba Especiais
│   ├── Propriedades/        # Aba Propriedades
│   ├── Inicio/              # Aba Início
│   ├── Historico/           # Aba Histórico
│   ├── MenuOptions/         # Menu de opções do jogador
│   ├── ColorDropdown/       # Dropdown de seleção de cor
│   ├── Loading/             # Componente de loading
│   ├── Title1/              # Componente de título
│   └── ui/                  # Componentes UI (Radix)
│       ├── button.tsx
│       ├── select.tsx
│       ├── table.tsx
│       └── dropdown-menu.tsx
│
├── stores/                  # Zustand stores
│   └── gameStore.ts         # Store de gerenciamento de jogo
│
├── hooks/                   # Custom hooks
│   └── useViewportHeight.ts
│
├── lib/                     # Utilitários
│   └── utils.ts             # Funções helper (cn, etc)
│
├── types/                   # Tipos TypeScript
│   └── game.ts              # Tipos relacionados ao jogo
│
└── public/                  # Arquivos estáticos
    └── images/              # Imagens
```

---

## Convenções de Código

### Nomenclatura
- Componentes: PascalCase (ex: `PlayerCard`, `Button01`)
- Arquivos de componente: `index.tsx` para o componente principal
- Hooks: prefixo `use` (ex: `useToast`, `useGameStore`)

### Imports
- Usar alias `@/` para caminhos a partir de `src/`
- Exemplo: `import Button1 from "@/components/Button01"`

### 'use client'
- Componentes que usam hooks, eventos, ou state devem ter `'use client'` no topo

### Estilização
- Preferir classes Tailwind inline vs styled-components
- Usar cores da paleta `zinc` para neutros
- Usar `purple-400/500` para accents principais
- Usar `green-400/500` para sucessos e CTAs positivos

---

## Variáveis de Ambiente

Verificar `.env.local` ou `.env.example` para configurações de API e URL do servidor.

---

## Scripts npm

```bash
npm run dev          # Iniciar desenvolvimento
npm run build        # Build de produção
npm run start        # Iniciar produção
npm run lint         # Verificar lint
```

---

## Notas Importantes

1. **Não usar react-toastify** - O projeto migrou para ToastProvider customizado
2. **Não usar Modal do Radix/Framer** - O projeto usa Modal customizado com GSAP
3. **Sempre manter tema dark** - Não usar cores claras (white, gray-50, etc)
4. **Respeitar/fonts** - Jaro para títulos, Inconsolata para textos
5. **Use client em componentes interativos** - Todos os componentes com state/hooks precisam