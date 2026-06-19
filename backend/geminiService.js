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
  getGeminiMode,
  isGeminiEnabled
};
