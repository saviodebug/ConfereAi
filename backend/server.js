require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { initializeDatabase, getHistory, getTrustedSources, getStats } = require("./database");
const { analyzeContent, getGeminiMode } = require("./analysisService");
const { isGeminiEnabled } = require("./geminiService");

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (request, response) => {
  response.json({
    status: "ok",
    geminiConfigurado: isGeminiEnabled(),
    modo: getGeminiMode()
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
    const rows = await getHistory();
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
    response.json(await getStats());
  } catch (error) {
    console.error("Erro ao consultar estatísticas:", error);
    response.status(500).json({ erro: "Não foi possível consultar as estatísticas." });
  }
});

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
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

initializeDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`VerificaVoto AI Gemini rodando em http://localhost:${port}`);
      console.log(`Modo atual: ${getGeminiMode()}`);

      if (!isGeminiEnabled()) {
        console.log("Gemini não configurado. O backend continuará usando apenas regras locais.");
      }
    });
  })
  .catch((error) => {
    console.error("Erro ao inicializar banco de dados:", error);
    process.exit(1);
  });
