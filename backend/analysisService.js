const { saveAnalysis, getTrustedSources } = require("./database");
const { analyzeByRules } = require("./rulesService");
const { extractKeywords } = require("./keywordService");
const { analyzeWithGemini, classifyScopeWithGemini, extractMetadataWithGemini, getGeminiMode } = require("./geminiService");

const DEFAULT_RECOMMENDATION =
  "Antes de compartilhar, verifique se a informação aparece em fontes oficiais, como TSE, TREs, Justiça Eleitoral ou em agências de checagem.";

async function analyzeContent(input) {
  const content = await enrichContentMetadata(sanitizeInput(input));
  const scope = await classifyScopeWithGemini(content);

  if (!scope.inScope) {
    const fontesSugeridas = await getTrustedSources();
    const result = {
      classificacao: "Fora do escopo",
      pontuacao: 0,
      sinais: [scope.justificativa],
      criterios: [
        {
          criterio: "Triagem de escopo com IA",
          ativo: true,
          pontos: 0
        }
      ],
      palavrasChave: [],
      fontesSugeridas,
      analiseIA: scope.justificativa,
      geminiStatus: scope.status,
      recomendacao: "Use o ConfereAí para notícias, prints ou postagens com relação política, eleitoral, jornalística ou cívica.",
      modo: "triagem Gemini",
      autor: content.autor,
      data: content.data,
      escopo: scope,
      aviso: "Esta ferramenta não determina se uma notícia é verdadeira ou falsa. Ela apenas aponta sinais de risco e recomenda verificação em fontes confiáveis."
    };

    await saveAnalysis({
      clientId: content.clientId,
      titulo: content.titulo,
      url: content.url,
      textoResumo: content.texto.slice(0, 600),
      classificacao: result.classificacao,
      pontuacao: result.pontuacao,
      sinais: result.sinais,
      criterios: result.criterios,
      palavrasChave: result.palavrasChave,
      analiseIA: result.analiseIA,
      geminiStatus: result.geminiStatus,
      observacoes: content.observacoes,
      modo: result.modo
    });

    return result;
  }

  const localAnalysis = analyzeByRules(content);
  const palavrasChave = await extractKeywords(content);
  const geminiResult = await analyzeWithGemini({
    titulo: content.titulo,
    url: content.url,
    texto: content.texto,
    sinaisLocais: localAnalysis.sinais,
    palavrasChave
  });
  const fontesSugeridas = await getTrustedSources();
  const analiseIA = geminiResult && geminiResult.usado ? geminiResult.texto : "";
  const geminiStatus = geminiResult ? geminiResult.status : "Gemini não executado";
  const modo = analiseIA ? "regras + Gemini" : "regras locais";

  const result = {
    classificacao: localAnalysis.classificacao,
    pontuacao: localAnalysis.pontuacao,
    sinais: localAnalysis.sinais,
    criterios: localAnalysis.criterios,
    palavrasChave,
    fontesSugeridas,
    analiseIA: analiseIA || "",
    geminiStatus,
    recomendacao: DEFAULT_RECOMMENDATION,
    modo,
    autor: content.autor,
    data: content.data,
    escopo: scope,
    aviso: "Esta ferramenta não determina se uma notícia é verdadeira ou falsa. Ela apenas aponta sinais de risco e recomenda verificação em fontes confiáveis."
  };

  await saveAnalysis({
    clientId: content.clientId,
    titulo: content.titulo,
    url: content.url,
    textoResumo: content.texto.slice(0, 600),
    classificacao: result.classificacao,
    pontuacao: result.pontuacao,
    sinais: result.sinais,
    criterios: result.criterios,
    palavrasChave: result.palavrasChave,
    analiseIA: result.analiseIA,
    geminiStatus: result.geminiStatus,
    observacoes: content.observacoes,
    modo: result.modo
  });

  return result;
}

function sanitizeInput(input) {
  return {
    titulo: String(input.titulo || input.title || "Título não informado").slice(0, 300),
    url: String(input.url || "").slice(0, 1000),
    texto: String(input.texto || input.text || "").slice(0, 8000),
    metadadosTexto: String(input.metadadosTexto || input.metadataText || "").slice(0, 3000),
    autor: String(input.autor || input.author || "").slice(0, 200),
    data: String(input.data || input.date || "").slice(0, 120),
    observacoes: String(input.observacoes || "").slice(0, 1000),
    clientId: String(input.clientId || input.client_id || "").slice(0, 120)
  };
}

async function enrichContentMetadata(content) {
  if (content.autor && content.data) {
    return content;
  }

  const metadata = await extractMetadataWithGemini(content);

  return {
    ...content,
    autor: metadata.autor || content.autor,
    data: metadata.data || content.data
  };
}

module.exports = {
  analyzeContent,
  getGeminiMode
};
