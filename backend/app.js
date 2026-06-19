require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { initializeDatabase, getHistory, getTrustedSources, getStats } = require("./database");
const { analyzeContent, getGeminiMode } = require("./analysisService");
const { isGeminiEnabled } = require("./geminiService");

const app = express();
let initializationPromise = null;

app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

app.use(async (request, response, next) => {
  try {
    await ensureInitialized();
    next();
  } catch (error) {
    next(error);
  }
});

app.get("/health", (request, response) => {
  response.json({
    status: "ok",
    geminiConfigurado: isGeminiEnabled(),
    modo: getGeminiMode(),
    banco: process.env.SUPABASE_URL ? "supabase" : "sqlite"
  });
});

app.post("/analisar", async (request, response) => {
  try {
    const result = await analyzeContent(request.body || {});
    response.json(result);
  } catch (error) {
    console.error("Erro ao analisar conteúdo:", error);
    response.status(500).json({
      erro: "Não foi possível analisar o conteúdo.",
      detalhe: "Verifique os logs do backend."
    });
  }
});

app.get("/historico", async (request, response) => {
  try {
    const rows = await getHistory(getClientId(request));
    response.json(rows.map(normalizeHistoryRow));
  } catch (error) {
    console.error("Erro ao consultar histórico:", error);
    response.status(500).json({ erro: "Não foi possível consultar o histórico." });
  }
});

app.get("/fontes", async (request, response) => {
  try {
    response.json(await getTrustedSources());
  } catch (error) {
    console.error("Erro ao consultar fontes:", error);
    response.status(500).json({ erro: "Não foi possível consultar as fontes confiáveis." });
  }
});

app.get("/estatisticas", async (request, response) => {
  try {
    response.json(await getStats(getClientId(request)));
  } catch (error) {
    console.error("Erro ao consultar estatísticas:", error);
    response.status(500).json({ erro: "Não foi possível consultar as estatísticas." });
  }
});

app.use((error, request, response, next) => {
  console.error("Erro interno do backend:", error);
  response.status(500).json({ erro: "Erro interno do backend." });
});

function ensureInitialized() {
  if (!initializationPromise) {
    initializationPromise = initializeDatabase();
  }

  return initializationPromise;
}

function getClientId(request) {
  return String(request.query.clientId || request.headers["x-verificavoto-client-id"] || "").slice(0, 120);
}

function normalizeHistoryRow(row) {
  return {
    id: row.id,
    titulo: row.titulo,
    url: row.url,
    textoResumo: row.texto_resumo,
    classificacao: row.classificacao,
    pontuacao: row.pontuacao,
    sinais: safeJsonParse(row.sinais_json, []),
    criterios: safeJsonParse(row.criterios_json, []),
    palavrasChave: safeJsonParse(row.palavras_chave_json, []),
    analiseIA: row.analise_ia,
    geminiStatus: row.gemini_status,
    observacoes: row.observacoes,
    modo: row.modo,
    createdAt: row.created_at
  };
}

function safeJsonParse(value, fallback) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

module.exports = {
  app,
  ensureInitialized
};
