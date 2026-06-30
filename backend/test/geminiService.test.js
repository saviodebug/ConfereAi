const test = require("node:test");
const assert = require("node:assert/strict");
const { _internals } = require("../geminiService");

test("parseGeminiJson aceita JSON envolvido por bloco markdown", () => {
  const parsed = _internals.parseGeminiJson('```json\n{"inScope": false, "categoria": "fora_do_escopo"}\n```');

  assert.equal(parsed.inScope, false);
  assert.equal(parsed.categoria, "fora_do_escopo");
});

test("normalizeScopeBoolean só trata string false como falso", () => {
  assert.equal(_internals.normalizeScopeBoolean(false), false);
  assert.equal(_internals.normalizeScopeBoolean("false"), false);
  assert.equal(_internals.normalizeScopeBoolean("true"), true);
  assert.equal(_internals.normalizeScopeBoolean(undefined), true);
});

test("cleanGeminiText remove markdown básico", () => {
  const clean = _internals.cleanGeminiText("**Análise**\n- Verifique em fonte oficial.");

  assert.equal(clean, "Análise\nVerifique em fonte oficial.");
});
