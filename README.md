# ConfereAí

ConfereAí é uma extensão para navegadores compatíveis com Manifest V3, criada para apoiar a análise de sinais de risco em notícias e prints sobre temas políticos e eleitorais.

A ferramenta não determina se uma notícia é verdadeira ou falsa. Ela aponta sinais de baixo, médio ou alto risco e recomenda verificação em fontes confiáveis.

## Como funciona

A extensão coleta o conteúdo informado pelo usuário e envia para uma API hospedada na Vercel. O backend aplica regras locais transparentes, consulta palavras-chave eleitorais, salva o histórico no Supabase e, quando configurado, usa Gemini apenas como complemento explicativo.

```text
Extensão em navegador compatível com Manifest V3
        ↓
API Node.js na Vercel
        ↓
Supabase/Postgres
        ↓
Gemini API opcional
```

A classificação principal sempre vem das regras locais. A IA não substitui os critérios de pontuação e não deve ser tratada como verificação definitiva.

## Recursos

- Análise da página atual aberta no navegador.
- Análise de prints/imagens com OCR local usando Tesseract.js.
- Suporte a colar print com `Ctrl+V`.
- Classificação por risco: baixo, médio ou alto.
- Pontuação baseada em critérios visíveis.
- Lista de sinais encontrados.
- Palavras-chave eleitorais detectadas.
- Fontes confiáveis sugeridas.
- Análise complementar da IA, quando disponível.
- Histórico recente separado por instalação da extensão.
- Dashboard com histórico, estatísticas e fontes.
- Botão para copiar relatório.
- Geração de relatório HTML para impressão ou PDF.

## Instalação da extensão

A mesma pasta `extensao/` pode ser carregada em Chrome, Brave, Edge e Firefox.

### Chrome, Brave ou Edge

1. Baixe ou clone este repositório.
2. Abra `chrome://extensions/` ou `brave://extensions/`.
3. Ative o modo de desenvolvedor.
4. Clique em `Carregar sem compactação` ou `Load unpacked`.
5. Selecione a pasta:

```text
extensao/
```

### Firefox

1. Baixe ou clone este repositório.
2. Abra `about:debugging#/runtime/this-firefox`.
3. Clique em `Carregar extensão temporária`.
4. Selecione o arquivo:

```text
extensao/manifest.json
```

Depois disso, abra uma notícia, post ou página de interesse e clique no ícone da extensão.

## Backend público

A extensão está configurada para usar a API:

```text
https://confereaiextensao.vercel.app
```

Endpoint de teste:

```text
https://confereaiextensao.vercel.app/health
```

Resposta esperada:

```json
{
  "status": "ok",
  "geminiConfigurado": true,
  "modo": "regras + Gemini",
  "banco": "supabase",
  "supabaseConfigurado": true
}
```

## Site do projeto

O ConfereAí também possui um site de apresentação publicado na Vercel:

```text
https://confereai-site.vercel.app
```

O site apresenta a extensão, seus recursos, autores, política de privacidade e links úteis.

## Histórico por instalação

Cada instalação da extensão gera um `clientId` local e envia esse identificador ao backend. Com isso, o histórico e as estatísticas são filtrados por instalação.

Isso significa que usuários diferentes usam o mesmo backend, mas não veem o histórico uns dos outros. Se a extensão for reinstalada ou os dados locais forem apagados, um novo `clientId` será criado.

## Critérios de análise

As regras locais observam sinais como:

- ausência de autor;
- ausência de data;
- linguagem alarmista;
- pedido de compartilhamento rápido;
- alegações graves sobre fraude eleitoral sem fonte oficial;
- ausência de fonte oficial;
- muitos termos em caixa alta;
- aparência suspeita da URL;
- presença de domínio jornalístico ou institucional conhecido;
- citação de fonte oficial;
- autor e data encontrados.

Pontuação:

- `0 a 2`: baixo risco;
- `3 a 6`: médio risco;
- `7 ou mais`: alto risco.

## Privacidade e segurança

- A chave Gemini fica somente no backend, em variáveis de ambiente da Vercel.
- A chave Supabase usada pelo backend também não fica na extensão.
- A extensão não contém chaves privadas.
- O OCR roda localmente dentro da extensão antes do texto ser enviado para análise.
- O histórico é separado por `clientId`, não por login.

## Estrutura do projeto

```text
confereai/
├── extensao/
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.css
│   ├── popup.js
│   ├── browser-compat.js
│   ├── content.js
│   ├── dashboard.html
│   ├── dashboard.css
│   ├── dashboard.js
│   ├── assets/
│   ├── icons/
│   └── vendor/tesseract/
├── backend/
│   ├── api/index.js
│   ├── app.js
│   ├── server.js
│   ├── database.js
│   ├── rulesService.js
│   ├── keywordService.js
│   ├── geminiService.js
│   ├── analysisService.js
│   ├── package.json
│   ├── vercel.json
│   └── .env.example
└── README.md
```

## Desenvolvimento local

Para rodar o backend localmente:

```bash
cd backend
npm install
npm run dev
```

O backend local roda em:

```text
http://localhost:3000
```

Teste:

```text
http://localhost:3000/health
```

Quando as variáveis do Supabase não estão configuradas, o backend usa SQLite local para desenvolvimento.

## Variáveis de ambiente

No backend, use `.env.example` como modelo:

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

Nunca envie `.env`, chaves Gemini ou chaves secretas Supabase para o GitHub.

## Rotas da API

- `GET /health`
- `POST /analisar`
- `GET /historico?clientId=...`
- `GET /fontes`
- `GET /estatisticas?clientId=...`

## Limitações

- A ferramenta não comprova verdade ou falsidade.
- Pode haver falsos positivos e falsos negativos.
- A captura da página depende da estrutura do site.
- O OCR pode errar em imagens borradas, cortadas ou com texto pequeno.
- A IA pode falhar, ficar indisponível ou interpretar contexto de forma incorreta.
- O `clientId` separa histórico por instalação, mas não é autenticação de usuário.

## Autores

- Savio Busana Beckhauser Junior
- Carolina Jardim Ribeiro

## Objetivo acadêmico

O ConfereAí foi desenvolvido como uma ferramenta de apoio à educação midiática. O foco é mostrar critérios transparentes de análise, uso responsável de IA e recomendação de checagem em fontes oficiais e jornalísticas confiáveis.
