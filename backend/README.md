# Backend ConfereAí

Backend em Node.js para receber dados da extensão, aplicar regras locais, consultar Gemini opcionalmente e salvar histórico no Supabase em produção. Em desenvolvimento local, quando Supabase não está configurado, o backend usa SQLite.

## Instalação

```bash
npm install
```

## Configuração

Copie `.env.example` para `.env`:

```bash
copy .env.example .env
```

Edite `.env`:

```env
PORT=3000
USE_GEMINI=true
USE_GEMINI_GROUNDING=false
GEMINI_API_KEY=cole-sua-chave-aqui
GEMINI_MODEL=gemini-flash-latest
GEMINI_FALLBACK_MODEL=gemini-3.5-flash
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=cole-sua-chave-secreta-somente-no-backend
```

Para testar sem Gemini:

```env
USE_GEMINI=false
GEMINI_API_KEY=
```

## Rodar

```bash
npm run dev
```

ou:

```bash
npm start
```

## Rotas

- `GET /health`
- `POST /analisar`
- `GET /historico?clientId=...`
- `GET /fontes`
- `GET /estatisticas?clientId=...`

O resultado de `POST /analisar` inclui critérios detalhados, fontes sugeridas, triagem de escopo, metadados encontrados e diagnóstico de uso da Gemini.

## Segurança da chave

A chave Gemini e a chave de serviço do Supabase ficam apenas no backend, em `.env` local ou nas variáveis de ambiente da Vercel. Elas nunca devem ser colocadas na extensão, no `popup.js`, no `content.js` ou no `manifest.json`.
