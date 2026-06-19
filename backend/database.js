const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const databasePath = path.join(__dirname, "database.sqlite");
const db = new sqlite3.Database(databasePath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows);
    });
  });
}

async function initializeDatabase() {
  await run(`
    CREATE TABLE IF NOT EXISTS analises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT,
      url TEXT,
      texto_resumo TEXT,
      classificacao TEXT,
      pontuacao INTEGER,
      sinais_json TEXT,
      palavras_chave_json TEXT,
      analise_ia TEXT,
      modo TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ensureColumn("analises", "criterios_json", "TEXT");
  await ensureColumn("analises", "observacoes", "TEXT");
  await ensureColumn("analises", "gemini_status", "TEXT");

  await run(`
    CREATE TABLE IF NOT EXISTS fontes_confiaveis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      url TEXT NOT NULL,
      tipo TEXT NOT NULL,
      ativo INTEGER DEFAULT 1
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS palavras_chave (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      termo TEXT NOT NULL UNIQUE,
      categoria TEXT NOT NULL,
      peso INTEGER DEFAULT 1
    )
  `);

  await seedTrustedSources();
  await seedKeywords();
}

async function ensureColumn(table, column, type) {
  const rows = await all(`PRAGMA table_info(${table})`);
  const exists = rows.some((row) => row.name === column);

  if (!exists) {
    await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}

async function seedTrustedSources() {
  const sources = [
    ["TSE", "https://www.tse.jus.br/", "fonte oficial"],
    ["Fato ou Boato", "https://www.tse.jus.br/hotsites/fato-ou-boato/", "checagem oficial"],
    ["TREs", "https://www.tse.jus.br/institucional/tribunais-regionais", "fonte oficial"],
    ["Agência Lupa", "https://lupa.uol.com.br/", "agência de checagem"],
    ["Aos Fatos", "https://www.aosfatos.org/", "agência de checagem"],
    ["Estadão Verifica", "https://www.estadao.com.br/estadao-verifica/", "agência de checagem"],
    ["Agência Brasil", "https://agenciabrasil.ebc.com.br/", "jornalismo público"],
    ["STF", "https://portal.stf.jus.br/", "fonte oficial"],
    ["Senado", "https://www12.senado.leg.br/", "fonte oficial"],
    ["Câmara dos Deputados", "https://www.camara.leg.br/", "fonte oficial"]
  ];

  for (const source of sources) {
    await run(
      "INSERT OR IGNORE INTO fontes_confiaveis (nome, url, tipo, ativo) VALUES (?, ?, ?, 1)",
      source
    );
  }
}

async function seedKeywords() {
  const keywords = [
    ["urna eletrônica", "processo eleitoral", 2],
    ["fraude eleitoral", "risco", 3],
    ["TSE", "instituição", 1],
    ["TRE", "instituição", 1],
    ["apuração", "processo eleitoral", 1],
    ["votação", "processo eleitoral", 1],
    ["pesquisa eleitoral", "campanha", 1],
    ["candidato", "campanha", 1],
    ["partido", "campanha", 1],
    ["eleição cancelada", "risco", 3],
    ["voto roubado", "risco", 3],
    ["sistema eleitoral", "processo eleitoral", 1],
    ["Justiça Eleitoral", "instituição", 1],
    ["boletim de urna", "processo eleitoral", 2],
    ["auditoria", "processo eleitoral", 1],
    ["urna fraudada", "risco", 3],
    ["apuração manipulada", "risco", 3]
  ];

  for (const keyword of keywords) {
    await run(
      "INSERT OR IGNORE INTO palavras_chave (termo, categoria, peso) VALUES (?, ?, ?)",
      keyword
    );
  }
}

async function saveAnalysis(analysis) {
  return run(
    `INSERT INTO analises (
      titulo,
      url,
      texto_resumo,
      classificacao,
      pontuacao,
      sinais_json,
      criterios_json,
      palavras_chave_json,
      analise_ia,
      gemini_status,
      observacoes,
      modo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      analysis.titulo,
      analysis.url,
      analysis.textoResumo,
      analysis.classificacao,
      analysis.pontuacao,
      JSON.stringify(analysis.sinais || []),
      JSON.stringify(analysis.criterios || []),
      JSON.stringify(analysis.palavrasChave || []),
      analysis.analiseIA || "",
      analysis.geminiStatus || "",
      analysis.observacoes || "",
      analysis.modo
    ]
  );
}

async function getKeywordTerms() {
  const rows = await all("SELECT termo FROM palavras_chave ORDER BY termo ASC");
  return rows.map((row) => row.termo);
}

async function getHistory() {
  return all(
    `SELECT
      id,
      titulo,
      url,
      texto_resumo,
      classificacao,
      pontuacao,
      sinais_json,
      criterios_json,
      palavras_chave_json,
      analise_ia,
      gemini_status,
      observacoes,
      modo,
      created_at
    FROM analises
    ORDER BY id DESC
    LIMIT 20`
  );
}

async function getTrustedSources() {
  return all(
    `SELECT id, nome, url, tipo, ativo
    FROM fontes_confiaveis
    WHERE ativo = 1
    ORDER BY nome ASC`
  );
}

async function getStats() {
  const totals = await all(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN modo = 'regras + Gemini' THEN 1 ELSE 0 END) AS com_gemini,
      SUM(CASE WHEN modo = 'regras locais' THEN 1 ELSE 0 END) AS regras_locais
    FROM analises
  `);
  const byRisk = await all(`
    SELECT classificacao, COUNT(*) AS total
    FROM analises
    GROUP BY classificacao
    ORDER BY total DESC
  `);

  return {
    total: totals[0].total || 0,
    comGemini: totals[0].com_gemini || 0,
    regrasLocais: totals[0].regras_locais || 0,
    porClassificacao: byRisk
  };
}

module.exports = {
  initializeDatabase,
  saveAnalysis,
  getKeywordTerms,
  getHistory,
  getTrustedSources,
  getStats
};
