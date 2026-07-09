# VT Car CRM (React)

Frontend novo do CRM, em React + Vite + Tailwind + Framer Motion + Recharts.
Substitui o `crm-vtcar.html` estático por um app de verdade, com animações,
gráficos reais e visual mais premium. Consome a mesma API do backend
(`gptmaker-integration/`) já em produção no Railway.

## Rodando local

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`. Clica em "Conectar backend" no topo e cola
a URL do Railway.

## Build de produção

```bash
npm run build
```

Gera a pasta `dist/` pronta pra qualquer hospedagem estática.

## Deploy na Vercel

1. Sobe essa pasta (`crm-web/`) num repositório GitHub (igual fizemos com o backend)
2. Na Vercel: **New Project** → conecta o repositório
3. A Vercel detecta Vite automaticamente (Build Command `npm run build`, Output `dist`) — não precisa mexer em nada
4. Deploy. Depois de pronto, abre o link, clica em "Conectar backend" e cola a URL do Railway

## Status

Dashboard e Leads já estão completos e conectados ao backend real. Pipeline,
Clientes, Veículos, Atividades e Relatórios ainda mostram um aviso de "em
construção" — próximas páginas a serem refeitas no mesmo padrão.
