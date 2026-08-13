# VT Car CRM

Frontend do CRM da VT Car, em React + Vite + Tailwind + Framer Motion + Recharts.
Os leads chegam sozinhos: a agente Vitória atende no WhatsApp pelo GPT Maker, e o
backend recebe os webhooks e alimenta este painel.

**No ar:** https://vtcar-crm-web.vercel.app

## O que já funciona

| Tela | Situação |
|---|---|
| **Dashboard** | Pronto. Todos os números saem dos leads reais — total, em negociação, fechados, taxa de conversão, leads por semana e origem por canal. |
| **Leads** | Pronto. Tabela com filtro por estágio, busca e ficha completa do lead. |
| **Pipeline** | Pronto. Kanban com arrastar-e-soltar entre os estágios (ou setas ← → no teclado). |
| **Ficha do lead** | Pronto. Histórico da conversa sincronizada e o **Coach de vendas**: resumo, nível de interesse, objeções detectadas e sugestão de resposta, gerados por IA. |
| Clientes, Veículos, Atividades, Relatórios | Em construção — cada uma mostra o que vai receber. |

## Backend

Este repositório é só o frontend. A API vive em outro projeto
(`gptmaker-integration`), hospedada no **Railway**:

```
https://vtcar-gptmaker-integration-production.up.railway.app
```

Essa URL já é o padrão no código (`src/api.js`, constante `DEFAULT_API_BASE`), então
o CRM abre conectado. Pra apontar pra outro servidor, use o botão no topo da tela —
o valor fica salvo no navegador e tem prioridade sobre o padrão.

> O endereço antigo no Render (`vtcar-gptmaker-integration.onrender.com`) não é mais
> usado. Se aparecer em algum lugar, está desatualizado.

Rotas consumidas:

| Método | Rota | Uso |
|---|---|---|
| `GET` | `/api/leads` | lista os leads (recarrega a cada 30s) |
| `POST` | `/api/leads` | cadastro manual |
| `PATCH` | `/api/leads/:id` | move o lead de estágio |
| `GET` | `/api/leads/:id/messages` | conversa sincronizada |
| `GET` `POST` | `/api/leads/:id/coach` | lê ou recalcula a análise do Coach |

## Rodando local

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`, já conectado no backend de produção.

```bash
npm run build     # gera dist/
npm run preview   # serve o build pra conferir antes de publicar
```

## Deploy

A Vercel está ligada a este repositório: **todo push na branch `main` publica em
produção automaticamente**. Não precisa rodar build na mão nem mexer em
configuração — a Vercel detecta o Vite sozinha.

Se for subir várias mudanças, mande tudo num commit só. Commit parcial deixa o
código inconsistente e o build falha.

## Como o projeto está organizado

```
src/
  api.js            chamadas HTTP e a URL padrão do backend
  format.js         telefone e nome do lead prontos pra tela
  index.css         design tokens (as cores dos dois temas moram aqui)
  App.jsx           casca, navegação, tema e o estado dos leads
  components/       Sidebar, Topbar, cards, badges, modais
  pages/            Dashboard, Leads, Pipeline
```

### Duas convenções que valem respeitar

**Cor vem de token, nunca de hex solto.** Tudo em `src/index.css` como variável CSS,
exposto no Tailwind (`bg-surface`, `text-ink2`, `border-line`, `bg-brand`…). Trocar de
tema — ou a cor da marca — é mexer numa variável, não caçar classe pelo projeto.
O vermelho da VT Car é cor de marca: botão principal, logo, item ativo. Nunca vira
cor de dado em gráfico.

**Dado não pode depender de animação pra aparecer certo.** O navegador congela as
animações quando a aba está em segundo plano; um número que "conta até o total" fica
parado num valor errado, e uma lista com fade fica invisível. Por isso o contador dos
KPIs checa `document.hidden` e tem trava de segurança, e as listas longas (Leads e
Pipeline) não têm animação de entrada.

## Dados: o que esperar

Os leads vêm do perfil do WhatsApp, então o dado bruto é bagunçado — tem contato sem
nome, só emoji, e telefone no formato `554396497125`. O `src/format.js` resolve isso na
exibição: formata o telefone, tira emoji do nome e, quando não sobra nome, mostra o
telefone no lugar. O dado guardado no backend continua intacto.

O campo `vehicleInterest` ainda chega vazio em todos os leads — a tela mostra
"A confirmar". Preencher isso automaticamente a partir da conversa é um próximo passo.
