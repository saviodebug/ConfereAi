# VerificaVoto AI Gemini

VerificaVoto AI Gemini é uma versão avançada e separada do VerificaVoto. Ela usa uma extensão Chrome Manifest V3, um backend local em Node.js, banco SQLite, análise por regras locais e análise complementar com Gemini API via Google AI Studio quando a chave estiver configurada.

A ferramenta não afirma que uma notícia é falsa ou verdadeira. Ela apenas aponta sinais de baixo, médio ou alto risco de desinformação e recomenda verificação em fontes confiáveis.

## Diferença para a versão gratuita por regras

A versão gratuita por regras roda localmente na extensão e não usa backend. Esta versão usa:

- Extensão Chrome para capturar página.
- Backend Node.js local.
- SQLite para histórico e cadastros.
- Regras locais como classificação principal.
- Gemini API opcional para explicação complementar.

A classificação principal continua vindo das regras locais. A Gemini apenas complementa a explicação.

## Estrutura

```text
verificavoto-ai-gemini/
├── extensao/
└── backend/
```

## Criar API Key no Google AI Studio

1. Acesse o Google AI Studio.
2. Entre com sua conta Google.
3. Crie uma API key.
4. Use apenas o Free Tier do Google AI Studio.
5. Não ative Google Cloud Billing.
6. Não use Google Cloud Agent Search.

## Configurar `.env`

No diretório `backend/`, copie `.env.example` para `.env`:

```bash
copy .env.example .env
```

Edite:

```env
PORT=3000
USE_GEMINI=true
USE_GEMINI_GROUNDING=false
GEMINI_API_KEY=cole-sua-chave-aqui
GEMINI_MODEL=gemini-flash-latest
GEMINI_FALLBACK_MODEL=gemini-3.5-flash
```

A chave deve ficar somente em `backend/.env`.

## Instalar dependências

```bash
cd backend
npm install
```

## Rodar backend

```bash
npm run dev
```

ou:

```bash
npm start
```

O backend deve ficar em:

```text
http://localhost:3000
```

Teste:

```text
http://localhost:3000/health
```

## Carregar extensão no Chrome

1. Abra `chrome://extensions/`.
2. Ative o modo de desenvolvedor.
3. Clique em `Carregar sem compactação`.
4. Selecione a pasta `verificavoto-ai-gemini/extensao`.
5. Abra uma notícia política ou eleitoral.
6. Clique na extensão.
7. Use uma das opções:
   - `Analisar página atual`: captura a aba aberta.
   - `Analisar print`: escolha imagem ou use `Ctrl+V` em qualquer lugar do popup.
   - `Analisar texto`: cole um trecho manualmente.
8. Use `Abrir dashboard` para ver histórico, estatísticas e fontes confiáveis.

Na análise de print, o OCR roda localmente na extensão com Tesseract.js. O texto extraído é enviado ao backend local para regras, palavras-chave, histórico e Gemini opcional.

## Recursos adicionados ao popup

- Histórico recente usando `GET /historico`.
- Dashboard em `extensao/dashboard.html`.
- Fontes confiáveis sugeridas usando `GET /fontes`.
- Campo de observações do usuário salvo no banco.
- Relatório HTML com botão para imprimir ou salvar como PDF.
- Contador de análises por regras locais e por Gemini usando `GET /estatisticas`.
- Tabela de critérios mostrando quais regras somaram ou reduziram pontos.
- Botão para copiar relatório.
- Diagnóstico de uso da Gemini, explicando se a IA foi usada, desativada, sem chave ou se falhou.

## Testar sem chave Gemini

No `.env`:

```env
USE_GEMINI=false
GEMINI_API_KEY=
```

Rode o backend. A extensão continuará funcionando com regras locais.

## Testar com chave Gemini

No `.env`:

```env
USE_GEMINI=true
GEMINI_API_KEY=sua-chave-do-google-ai-studio
```

Rode o backend novamente. A resposta deve mostrar modo `regras + Gemini` quando a chamada funcionar.

## Fallback para regras locais

Se não houver chave, se `USE_GEMINI=false`, se a API atingir limite, ou se o modelo configurado der erro, o backend retorna análise local. A extensão não deve quebrar.

Se a Gemini retornar erro temporário como `503 UNAVAILABLE` ou `model is currently overloaded`, o backend faz novas tentativas. Se ainda falhar, tenta `GEMINI_FALLBACK_MODEL` e outros modelos de fallback no código. Se mesmo assim não funcionar, a análise segue por regras locais e o popup mostra o motivo no campo `Gemini`.

## Não expor a chave

A chave Gemini não pode ir no frontend porque qualquer pessoa poderia inspecionar os arquivos da extensão e copiar a chave. Por isso a extensão chama apenas:

```text
POST http://localhost:3000/analisar
```

O backend lê:

```js
process.env.GEMINI_API_KEY
```

## Limitações

- A ferramenta não determina verdade ou falsidade.
- Pode haver falsos positivos e falsos negativos.
- A captura depende da estrutura da página.
- A Gemini pode falhar por limite, modelo indisponível ou chave inválida.
- O histórico fica em SQLite local.
- Não há autenticação porque o backend foi feito para uso local acadêmico.

## Trocar modelo Gemini

Se o modelo padrão der erro, altere no `.env`:

```env
GEMINI_MODEL=gemini-1.5-flash
```

ou outro modelo disponível na sua conta do Google AI Studio.

Você também pode manter um modelo alternativo:

```env
GEMINI_FALLBACK_MODEL=gemini-3.5-flash
```

A documentação oficial atual da Gemini API lista `gemini-3.5-flash` como exemplo de modelo estável e `gemini-flash-latest` como alias que pode mudar com o tempo. Se sua chave não tiver acesso a um deles, rode o backend e observe o diagnóstico no console para trocar o valor no `.env`.

## PTT da faculdade

Este projeto pode ser apresentado como Produto Técnico-Tecnológico voltado à educação midiática e à análise preventiva de risco de desinformação eleitoral.

Pontos para apresentação:

- Problema: circulação de conteúdos eleitorais sem fonte clara.
- Solução: extensão com backend local, regras transparentes e IA complementar.
- Diferencial: chave protegida no backend e fallback sem IA.
- Banco: histórico de análises, fontes confiáveis e palavras-chave.
- Limitação ética: não acusa, não define verdade/falsidade e recomenda checagem manual.

## Arquivos principais

- `extensao/manifest.json`: Manifest V3.
- `extensao/content.js`: captura título, URL, texto, autor e data.
- `extensao/popup.js`: analisa página, print com OCR local e texto colado, envia ao backend e renderiza o resultado.
- `extensao/dashboard.html`: painel de histórico, estatísticas e fontes.
- `extensao/vendor/tesseract/`: OCR local usado para extrair texto de prints.
- `backend/server.js`: rotas Express.
- `backend/database.js`: SQLite e seed inicial.
- `backend/rulesService.js`: análise local por regras.
- `backend/keywordService.js`: extração de palavras-chave eleitorais.
- `backend/geminiService.js`: Gemini opcional via `@google/genai`.
- `backend/analysisService.js`: orquestra regras, keywords, Gemini e banco.
