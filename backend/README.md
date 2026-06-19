# Backend ConfereAí

Backend local em Node.js para receber dados da extensão, aplicar regras locais, consultar Gemini opcionalmente e salvar o resultado em SQLite.

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
- `GET /historico`
- `GET /fontes`
- `GET /estatisticas`

O resultado de `POST /analisar` inclui critérios detalhados, fontes sugeridas e diagnóstico de uso da Gemini.

## Segurança da chave

A chave Gemini fica apenas no backend, em `.env`. Ela nunca deve ser colocada na extensão, no `popup.js`, no `content.js` ou no `manifest.json`.
