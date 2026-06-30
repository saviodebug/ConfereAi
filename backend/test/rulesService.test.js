const test = require("node:test");
const assert = require("node:assert/strict");
const { analyzeByRules } = require("../rulesService");

test("classifica conteúdo alarmista sem fonte oficial como alto risco", () => {
  const result = analyzeByRules({
    titulo: "URGENTE fraude eleitoral comprovada",
    url: "https://exemplo-click.xyz/noticia-123456789012",
    texto: "Compartilhe antes que apaguem. A mídia esconde que houve fraude eleitoral e voto roubado.",
    autor: "",
    data: ""
  });

  assert.equal(result.classificacao, "Alto risco");
  assert.ok(result.pontuacao >= 7);
  assert.ok(result.sinais.some((signal) => signal.includes("fraude eleitoral")));
});

test("reduz risco quando há domínio conhecido, autor, data e fonte oficial", () => {
  const result = analyzeByRules({
    titulo: "TSE publica orientação sobre votação",
    url: "https://www.tse.jus.br/comunicacao/noticias/2026/orientacao",
    texto: "Por Assessoria de Comunicação. Publicado em 30/06/2026. O Tribunal Superior Eleitoral informou novas orientações oficiais.",
    autor: "Assessoria de Comunicação",
    data: "30/06/2026"
  });

  assert.equal(result.classificacao, "Baixo risco");
  assert.equal(result.pontuacao, 0);
});

