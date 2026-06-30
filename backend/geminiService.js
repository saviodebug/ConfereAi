const { GoogleGenAI } = require("@google/genai");

function isGeminiEnabled() {
  return process.env.USE_GEMINI === "true" && Boolean(process.env.GEMINI_API_KEY);
}

function getGeminiMode() {
  return isGeminiEnabled() ? "regras + Gemini" : "regras locais";
}

async function analyzeWithGemini({ titulo, url, texto, sinaisLocais, palavrasChave }) {
  if (!isGeminiEnabled()) {
    return {
      texto: "",
      status: process.env.USE_GEMINI === "true" ? "Gemini sem chave configurada" : "Gemini desativado no .env",
      usado: false
    };
  }

  if (process.env.USE_GEMINI_GROUNDING === "true") {
    console.warn("USE_GEMINI_GROUNDING está true, mas Grounding não foi implementado por padrão neste protótipo.");
  }

  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash";
  const candidateModels = buildCandidateModels(model, fallbackModel);
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const currentDate = getCurrentDatePtBr();

  const prompt = `
Você é um assistente de apoio à análise de confiabilidade de notícias eleitorais.
Data atual de referência para esta análise: ${currentDate}.
Analise o conteúdo abaixo e identifique sinais de risco de desinformação.
Não afirme que a notícia é falsa ou verdadeira.
Não dê julgamento absoluto.
Aponte apenas indícios, como ausência de fonte, linguagem alarmista, falta de autoria, ausência de data, alegações graves sem comprovação e necessidade de checagem em fontes oficiais.
Responda em português do Brasil, de forma curta, objetiva e adequada para um usuário comum.
Responda em texto simples, sem Markdown, sem asteriscos, sem listas com símbolos e sem títulos formatados.
Não invente fontes.
Não acuse pessoas ou instituições.
Não declare que uma data é futura ou incoerente apenas por ser posterior ao seu treinamento. Use a data atual de referência acima e os dados enviados pela extensão.
Se o conteúdo vier de domínio jornalístico ou institucional conhecido, não trate isso como simulação de veículo conhecido sem outro indício claro.
Se houver dúvida, diga que é necessário verificar em fontes oficiais, sem afirmar que o conteúdo é fictício.

Título: ${titulo || "não informado"}
URL: ${url || "não informada"}
Palavras-chave detectadas: ${(palavrasChave || []).join(", ") || "nenhuma"}
Sinais locais: ${(sinaisLocais || []).join(" | ") || "nenhum"}

Texto:
${String(texto || "").slice(0, 8000)}

Retorne:
Análise curta:
Principais riscos:
Recomendação:
Observação:
`;

  try {
    const { response, usedModel } = await generateWithModelCandidates(ai, candidateModels, prompt);
    const cleanText = cleanGeminiText(response.text || "");

    return {
      texto: cleanText,
      status: usedModel === model ? "Gemini usado com sucesso" : `Gemini usado com modelo alternativo: ${usedModel}`,
      usado: Boolean(cleanText)
    };
  } catch (error) {
    logGeminiError(candidateModels.join(", "), error);
    return {
      texto: "",
      status: buildGeminiFailureStatus(error),
      usado: false
    };
  }
}

async function classifyScopeAndAnalyzeWithGemini({ titulo, url, texto }) {
  if (!isGeminiEnabled()) {
    return {
      scope: {
        inScope: true,
        categoria: "triagem_indisponivel",
        justificativa: "Gemini não está configurado. A análise seguirá pelas regras locais.",
        status: process.env.USE_GEMINI === "true" ? "Triagem Gemini sem chave configurada" : "Triagem Gemini desativada no .env",
        usado: false
      },
      analysis: {
        texto: "",
        status: process.env.USE_GEMINI === "true" ? "Gemini sem chave configurada" : "Gemini desativado no .env",
        usado: false
      }
    };
  }

  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash";
  const candidateModels = buildCandidateModels(model, fallbackModel);
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const currentDate = getCurrentDatePtBr();
  const prompt = `
Você apoia o ConfereAí, uma extensão de educação midiática.
Data atual de referência: ${currentDate}.

Primeiro classifique se o conteúdo está dentro do escopo:
- notícia política ou eleitoral;
- alegação sobre governo, eleições, candidatos, partidos, urnas, Justiça Eleitoral, TSE, TREs, Congresso, STF, prefeituras, câmaras, políticas públicas ou autoridades públicas;
- conteúdo jornalístico, print, postagem ou texto opinativo com possível impacto cívico.

Fora do escopo:
- frase casual, elogio, piada, conversa pessoal, texto sem relação cívica, política, eleitoral ou jornalística.

Se estiver dentro do escopo, escreva uma análise complementar curta. Não afirme que a notícia é falsa ou verdadeira. Não acuse pessoas ou instituições. Não invente fontes.
Se estiver fora do escopo, deixe analiseComplementar vazia.

Responda somente com JSON válido, sem Markdown:
{
  "inScope": true,
  "categoria": "politica_eleitoral",
  "justificativa": "frase curta em português do Brasil",
  "analiseComplementar": "texto curto em português do Brasil"
}

Título: ${titulo || "não informado"}
URL: ${url || "não informada"}
Texto:
${String(texto || "").slice(0, 7000)}
`;

  try {
    const { response, usedModel } = await generateWithModelCandidates(ai, candidateModels, prompt);
    const parsed = parseGeminiJson(response.text || "");
    const inScope = normalizeScopeBoolean(parsed.inScope);
    const analysisText = inScope ? cleanGeminiText(parsed.analiseComplementar || "") : "";
    const status = usedModel === model ? "Triagem e análise Gemini usadas com sucesso" : `Triagem e análise Gemini usadas com modelo alternativo: ${usedModel}`;

    return {
      scope: {
        inScope,
        categoria: String(parsed.categoria || "incerto").slice(0, 80),
        justificativa: String(parsed.justificativa || "Conteúdo classificado pela triagem de escopo.").slice(0, 280),
        status,
        usado: true
      },
      analysis: {
        texto: analysisText,
        status,
        usado: Boolean(analysisText)
      }
    };
  } catch (error) {
    logGeminiError(candidateModels.join(", "), error);
    const fallbackScope = await classifyScopeWithGemini({ titulo, url, texto });
    const fallbackAnalysis = fallbackScope.inScope
      ? await analyzeWithGemini({ titulo, url, texto, sinaisLocais: [], palavrasChave: [] })
      : { texto: "", status: fallbackScope.status, usado: false };

    return {
      scope: fallbackScope,
      analysis: fallbackAnalysis
    };
  }
}

async function classifyScopeWithGemini({ titulo, url, texto }) {
  if (!isGeminiEnabled()) {
    return {
      inScope: true,
      categoria: "triagem_indisponivel",
      justificativa: "Gemini não está configurado. A análise seguirá pelas regras locais.",
      status: process.env.USE_GEMINI === "true" ? "Triagem Gemini sem chave configurada" : "Triagem Gemini desativada no .env",
      usado: false
    };
  }

  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash";
  const candidateModels = buildCandidateModels(model, fallbackModel);
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = `
Classifique se o conteúdo está dentro do escopo do ConfereAí.

Escopo aceito:
- notícia política ou eleitoral;
- alegação sobre governo, eleições, candidatos, partidos, urnas, Justiça Eleitoral, TSE, TREs, Congresso, STF, prefeituras, câmaras, políticas públicas ou autoridades públicas;
- conteúdo jornalístico, print, postagem ou texto opinativo com possível impacto cívico.

Fora do escopo:
- frase casual, elogio, piada, conversa pessoal, texto sem relação cívica, política, eleitoral ou jornalística.

Responda somente com JSON válido, sem Markdown:
{
  "inScope": false,
  "categoria": "fora_do_escopo",
  "justificativa": "frase curta em português do Brasil"
}

Título: ${titulo || "não informado"}
URL: ${url || "não informada"}
Texto:
${String(texto || "").slice(0, 5000)}
`;

  try {
    const { response, usedModel } = await generateWithModelCandidates(ai, candidateModels, prompt);
    const parsed = parseGeminiJson(response.text || "");
    const inScope = normalizeScopeBoolean(parsed.inScope);

    return {
      inScope,
      categoria: String(parsed.categoria || "incerto").slice(0, 80),
      justificativa: String(parsed.justificativa || "Conteúdo classificado pela triagem de escopo.").slice(0, 280),
      status: usedModel === model ? "Triagem Gemini usada com sucesso" : `Triagem Gemini usada com modelo alternativo: ${usedModel}`,
      usado: true
    };
  } catch (error) {
    logGeminiError(candidateModels.join(", "), error);
    return {
      inScope: true,
      categoria: "triagem_indisponivel",
      justificativa: "Não foi possível confirmar o escopo com Gemini. A análise seguirá pelas regras locais.",
      status: buildGeminiFailureStatus(error),
      usado: false
    };
  }
}

async function extractMetadataWithGemini({ titulo, url, texto, metadadosTexto, autor, data }) {
  if (!isGeminiEnabled() || (autor && data)) {
    return {
      autor: autor || "",
      data: data || "",
      status: isGeminiEnabled() ? "Metadados já preenchidos sem Gemini" : "Extração Gemini de metadados desativada",
      usado: false
    };
  }

  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash";
  const candidateModels = buildCandidateModels(model, fallbackModel);
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = `
Extraia somente metadados explícitos do conteúdo jornalístico abaixo.
Não invente autor, veículo, local ou data.
Se o autor ou a data não aparecerem literalmente no texto, retorne string vazia nesse campo.
Aceite autores no formato "Por Redação g1, g1 — São Paulo", "Redação g1", nomes de jornalistas ou blocos equivalentes.
Responda somente com JSON válido, sem Markdown:
{
  "autor": "",
  "data": ""
}

Autor já capturado: ${autor || "vazio"}
Data já capturada: ${data || "vazio"}
Título: ${titulo || "não informado"}
URL: ${url || "não informada"}
Texto:
${String(metadadosTexto || "").slice(0, 2500)}

${String(texto || "").slice(0, 2500)}
`;

  try {
    const { response, usedModel } = await generateWithModelCandidates(ai, candidateModels, prompt);
    const parsed = parseGeminiJson(response.text || "");

    return {
      autor: autor || String(parsed.autor || "").slice(0, 200),
      data: data || String(parsed.data || "").slice(0, 120),
      status: usedModel === model ? "Metadados extraídos com Gemini" : `Metadados extraídos com modelo alternativo: ${usedModel}`,
      usado: true
    };
  } catch (error) {
    logGeminiError(candidateModels.join(", "), error);
    return {
      autor: autor || "",
      data: data || "",
      status: buildGeminiFailureStatus(error),
      usado: false
    };
  }
}

async function generateWithModelCandidates(ai, models, prompt) {
  let lastError;

  for (const model of models) {
    try {
      const response = await generateWithRetry(ai, model, prompt);
      return { response, usedModel: model };
    } catch (error) {
      lastError = error;
      console.warn(`Gemini falhou com ${model}: ${error.message}`);

      if (!shouldTryNextModel(error)) {
        throw error;
      }
    }
  }

  throw lastError;
}

function buildCandidateModels(model, fallbackModel) {
  return Array.from(new Set([
    model,
    fallbackModel,
    "gemini-3.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash"
  ].filter(Boolean)));
}

async function generateWithRetry(ai, model, prompt) {
  const maxAttempts = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await ai.models.generateContent({
        model,
        contents: prompt
      });
    } catch (error) {
      lastError = error;

      if (!isTemporaryGeminiError(error) || attempt === maxAttempts) {
        throw error;
      }

      await wait(700 * attempt);
    }
  }

  throw lastError;
}

function shouldTryNextModel(error) {
  const message = String(error && error.message ? error.message : error);
  return isTemporaryGeminiError(error) ||
    message.includes("404") ||
    message.includes("not found") ||
    message.includes("not supported") ||
    message.includes("model");
}

function isTemporaryGeminiError(error) {
  const message = String(error && error.message ? error.message : error);
  return message.includes("503") ||
    message.includes("UNAVAILABLE") ||
    message.includes("overloaded") ||
    message.includes("temporar");
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getCurrentDatePtBr() {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(new Date());
}

function cleanGeminiText(text) {
  return String(text || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^\s*---+\s*$/gm, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseGeminiJson(text) {
  const cleanText = String(text || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const match = cleanText.match(/\{[\s\S]*\}/);

  return JSON.parse(match ? match[0] : cleanText);
}

function normalizeScopeBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.trim().toLowerCase() !== "false";
  }

  return true;
}

function buildGeminiFailureStatus(error) {
  const message = String(error && error.message ? error.message : error);

  if (isTemporaryGeminiError(error)) {
    return "Gemini indisponível temporariamente. A análise foi feita por regras locais.";
  }

  if (message.includes("API key") || message.includes("API_KEY") || message.includes("401") || message.includes("403")) {
    return "Gemini não autorizado. Verifique a chave no arquivo .env.";
  }

  if (message.includes("not found") || message.includes("model") || message.includes("404")) {
    return "Modelos Gemini indisponíveis para esta chave. Verifique os modelos no Google AI Studio e ajuste GEMINI_MODEL no .env.";
  }

  return "Gemini falhou. A análise foi feita por regras locais.";
}

function logGeminiError(model, error) {
  console.error("Falha ao consultar Gemini.");
  console.error("Verifique GEMINI_API_KEY, GEMINI_MODEL, GEMINI_FALLBACK_MODEL e limites do Google AI Studio Free Tier.");
  console.error(`Modelo configurado: ${model}`);
  console.error(error.message);
}

module.exports = {
  analyzeWithGemini,
  classifyScopeAndAnalyzeWithGemini,
  classifyScopeWithGemini,
  extractMetadataWithGemini,
  getGeminiMode,
  isGeminiEnabled,
  _internals: {
    cleanGeminiText,
    normalizeScopeBoolean,
    parseGeminiJson
  }
};
