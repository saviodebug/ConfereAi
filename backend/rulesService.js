const OFFICIAL_TERMS = [
  "tse",
  "tre",
  "justiça eleitoral",
  "justica eleitoral",
  "tribunal superior eleitoral",
  "tribunal regional eleitoral",
  "stf",
  "diário oficial",
  "diario oficial",
  "senado",
  "câmara dos deputados",
  "camara dos deputados"
];

const ALARMIST_TERMS = [
  "urgente",
  "bomba",
  "escândalo",
  "escandalo",
  "compartilhe antes que apaguem",
  "a mídia esconde",
  "a midia esconde",
  "não querem que você saiba",
  "nao querem que voce saiba",
  "fraude comprovada",
  "verdade oculta",
  "repasse para todos",
  "estão escondendo",
  "estao escondendo"
];

const SHARE_TERMS = [
  "compartilhe agora",
  "compartilhe antes que apaguem",
  "repasse para todos",
  "envie para todos",
  "espalhe antes que apaguem"
];

const FRAUD_CLAIMS = [
  "fraude eleitoral",
  "urna fraudada",
  "voto roubado",
  "apuração manipulada",
  "apuracao manipulada",
  "eleição roubada",
  "eleicao roubada",
  "tse escondeu",
  "eleição cancelada",
  "eleicao cancelada"
];

const KNOWN_DOMAINS = [
  "tse.jus.br",
  "stf.jus.br",
  "gov.br",
  "camara.leg.br",
  "senado.leg.br",
  "g1.globo.com",
  "oglobo.globo.com",
  "folha.uol.com.br",
  "uol.com.br",
  "estadao.com.br",
  "bbc.com",
  "reuters.com",
  "agenciabrasil.ebc.com.br",
  "cnnbrasil.com.br",
  "valor.globo.com",
  "lupa.uol.com.br",
  "aosfatos.org"
];

function analyzeByRules(content) {
  const titulo = content.titulo || "";
  const url = content.url || "";
  const texto = content.texto || "";
  const combinedText = `${titulo}\n${texto}`;
  const normalizedText = normalize(combinedText);
  const sinais = [];
  const criterios = [];
  let pontuacao = 0;

  const foundAuthor = Boolean(content.autor) || hasAuthorInText(combinedText);
  const foundDate = Boolean(content.data) || hasDateInText(combinedText);
  const foundOfficialSource = containsAny(normalizedText, OFFICIAL_TERMS);
  const foundFraudClaim = containsAny(normalizedText, FRAUD_CLAIMS);
  const foundAlarmist = containsAny(normalizedText, ALARMIST_TERMS);
  const foundShareRequest = containsAny(normalizedText, SHARE_TERMS);
  const manyUppercase = hasManyUppercaseTerms(combinedText);
  const suspiciousUrl = hasSuspiciousUrl(url);
  const knownDomain = isKnownReliableDomain(url);

  pontuacao += addCriterion(criterios, sinais, !foundAuthor, "Ausência de autor", 2, "Não foi encontrado autor identificado.");
  pontuacao += addCriterion(criterios, sinais, !foundDate, "Ausência de data", 1, "Não foi encontrada data de publicação ou atualização.");
  pontuacao += addCriterion(criterios, sinais, foundAlarmist, "Linguagem alarmista", 2, "Foi encontrada linguagem alarmista ou sensacionalista.");
  pontuacao += addCriterion(criterios, sinais, foundShareRequest, "Pedido de compartilhamento rápido", 2, "Foi encontrado pedido de compartilhamento rápido.");
  pontuacao += addCriterion(
    criterios,
    sinais,
    foundFraudClaim && !foundOfficialSource,
    "Alegação grave sem fonte oficial",
    3,
    "Há alegação grave sobre fraude eleitoral sem fonte oficial identificada."
  );
  pontuacao += addCriterion(
    criterios,
    sinais,
    !foundOfficialSource,
    "Ausência de fonte oficial",
    2,
    "Não foram encontradas fontes oficiais como TSE, TRE ou Justiça Eleitoral."
  );
  pontuacao += addCriterion(criterios, sinais, manyUppercase, "Muitos termos em caixa alta", 1, "Há muitos termos em caixa alta no título ou no texto.");
  pontuacao += addCriterion(criterios, sinais, suspiciousUrl, "URL suspeita", 1, "A URL tem sinais de aparência suspeita.");
  pontuacao += addCriterion(criterios, sinais, knownDomain, "Domínio conhecido", -1, "A página está em domínio jornalístico ou institucional conhecido.");
  pontuacao += addCriterion(
    criterios,
    sinais,
    foundOfficialSource,
    "Fonte oficial citada",
    -2,
    "O conteúdo cita TSE, TRE, Justiça Eleitoral ou outra fonte oficial."
  );
  pontuacao += addCriterion(criterios, sinais, foundAuthor && foundDate, "Autor e data encontrados", -1, "Foram encontrados autor e data.");

  pontuacao = Math.max(0, pontuacao);

  if (!sinais.length) {
    sinais.push("Nenhum sinal relevante foi encontrado pelas regras locais.");
  }

  return {
    pontuacao,
    classificacao: classify(pontuacao),
    sinais,
    criterios
  };
}

function addCriterion(criterios, sinais, ativo, criterio, pontos, descricao) {
  criterios.push({
    criterio,
    ativo,
    pontos: ativo ? pontos : 0,
    descricao
  });

  if (ativo) {
    const sign = pontos > 0 ? `+${pontos}` : String(pontos);
    sinais.push(`${descricao} (${sign})`);
    return pontos;
  }

  return 0;
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function containsAny(normalizedText, terms) {
  return terms.some((term) => normalizedText.includes(normalize(term)));
}

function hasAuthorInText(text) {
  const compactText = String(text || "").replace(/\s+/g, " ");
  return /\b[Pp]or\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][^.!?]{3,180}/.test(compactText) ||
    /\b[Aa]utor(?:a)?\s*[:\-]\s*[^.!?]{3,120}/.test(compactText) ||
    /\b[Pp]ublicado por\s+[^.!?]{3,120}/.test(compactText);
}

function hasDateInText(text) {
  const compactText = String(text || "").replace(/\s+/g, " ");
  const patterns = [
    /\b\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*\d{2,4}\b/,
    /\b\d{1,2}\s*[-.]\s*\d{1,2}\s*[-.]\s*\d{2,4}\b/,
    /\b\d{1,2}\s+\d{1,2}\s+\d{4}\b/,
    /\b\d{1,2}\s+de\s+(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+\d{4}\b/i,
    /\b20\d{2}\s*-\s*\d{1,2}\s*-\s*\d{1,2}\b/
  ];

  return patterns.some((pattern) => pattern.test(compactText)) || hasOcrDate(compactText);
}

function hasOcrDate(text) {
  const normalizedDateText = String(text || "")
    .replace(/[|Il]/g, "1")
    .replace(/[Oo]/g, "0");
  const matches = normalizedDateText.match(/\b\d{1,2}\D{0,3}\d{1,2}\D{0,3}\d{4}\b/g) || [];

  return matches.some((value) => {
    const parts = value.match(/\d+/g) || [];

    if (parts.length < 3) {
      return false;
    }

    const day = Number(parts[0]);
    const month = Number(parts[1]);
    const year = Number(parts[2]);

    return day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000 && year <= 2099;
  });
}

function hasManyUppercaseTerms(text) {
  const words = String(text || "").match(/\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{4,}\b/g) || [];
  return words.length >= 8;
}

function hasSuspiciousUrl(url) {
  const normalizedUrl = String(url || "").toLowerCase();

  if (normalizedUrl.startsWith("print enviado")) {
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();
    const path = parsedUrl.pathname;
    const pathWithoutDates = path.replace(/\/20\d{2}\/\d{2}\/\d{2}\//g, "/");
    const manyNumbers = (pathWithoutDates.match(/\d/g) || []).length >= 12;
    const manyHyphens = (path.match(/-/g) || []).length >= 9;
    const oddDomain = /\.(xyz|top|club|click|biz|live)$/i.test(host);

    return manyNumbers || manyHyphens || oddDomain;
  } catch (error) {
    return false;
  }
}

function isKnownReliableDomain(url) {
  try {
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();

    if (host.startsWith("tre-") && host.endsWith(".jus.br")) {
      return true;
    }

    return KNOWN_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch (error) {
    return false;
  }
}

function classify(score) {
  if (score >= 7) {
    return "Alto risco";
  }

  if (score >= 3) {
    return "Médio risco";
  }

  return "Baixo risco";
}

module.exports = {
  analyzeByRules
};
