const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const databasePath = path.join(__dirname, "database.sqlite");
const useSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabase = useSupabase
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;
const db = useSupabase
  ? null
  : process.env.VERCEL
    ? null
    : new (require("sqlite3").verbose().Database)(databasePath);

const trustedSourcesSeed = [
  ["TSE", "https://www.tse.jus.br/", "fonte oficial"],
  ["TREs", "https://www.tse.jus.br/institucional/tribunais-regionais", "fonte oficial"],
  ["Agência Lupa", "https://lupa.uol.com.br/", "agência de checagem"],
  ["Aos Fatos", "https://www.aosfatos.org/", "agência de checagem"],
  ["Estadão Verifica", "https://www.estadao.com.br/estadao-verifica/", "agência de checagem"],
  ["Agência Brasil", "https://agenciabrasil.ebc.com.br/", "jornalismo público"],
  ["STF", "https://portal.stf.jus.br/", "fonte oficial"],
  ["Senado", "https://www12.senado.leg.br/", "fonte oficial"],
  ["Câmara dos Deputados", "https://www.camara.leg.br/", "fonte oficial"]
];

const keywordSeed = [
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
  if (useSupabase) {
    await seedTrustedSourcesSupabase();
    await seedKeywordsSupabase();
    return;
  }

  if (process.env.VERCEL) {
    throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar configuradas na Vercel.");
  }

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
  await ensureColumn("analises", "client_id", "TEXT");

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
  for (const source of trustedSourcesSeed) {
    await run(
      "INSERT OR IGNORE INTO fontes_confiaveis (nome, url, tipo, ativo) VALUES (?, ?, ?, 1)",
      source
    );
  }
}

async function seedKeywords() {
  for (const keyword of keywordSeed) {
    await run(
      "INSERT OR IGNORE INTO palavras_chave (termo, categoria, peso) VALUES (?, ?, ?)",
      keyword
    );
  }
}

async function saveAnalysis(analysis) {
  if (useSupabase) {
    const { error } = await supabase.from("analises").insert({
      client_id: analysis.clientId,
      titulo: analysis.titulo,
      url: analysis.url,
      texto_resumo: analysis.textoResumo,
      classificacao: analysis.classificacao,
      pontuacao: analysis.pontuacao,
      sinais_json: analysis.sinais || [],
      criterios_json: analysis.criterios || [],
      palavras_chave_json: analysis.palavrasChave || [],
      analise_ia: analysis.analiseIA || "",
      gemini_status: analysis.geminiStatus || "",
      observacoes: analysis.observacoes || "",
      modo: analysis.modo
    });

    if (error) {
      throw error;
    }

    return { id: null, changes: 1 };
  }

  return run(
    `INSERT INTO analises (
      client_id,
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      analysis.clientId,
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
  if (useSupabase) {
    const { data, error } = await supabase
      .from("palavras_chave")
      .select("palavra")
      .order("palavra", { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []).map((row) => row.palavra).filter(Boolean);
  }

  const rows = await all("SELECT termo FROM palavras_chave ORDER BY termo ASC");
  return rows.map((row) => row.termo);
}

async function getHistory(clientId) {
  if (useSupabase) {
    let query = supabase
      .from("analises")
      .select("id, titulo, url, texto_resumo, classificacao, pontuacao, sinais_json, criterios_json, palavras_chave_json, analise_ia, gemini_status, observacoes, modo, created_at")
      .order("id", { ascending: false })
      .limit(20);

    if (clientId) {
      query = query.eq("client_id", clientId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data || [];
  }

  const params = [];
  const where = clientId ? "WHERE client_id = ?" : "";

  if (clientId) {
    params.push(clientId);
  }

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
    ${where}
    ORDER BY id DESC
    LIMIT 20`,
    params
  );
}

async function getTrustedSources() {
  if (useSupabase) {
    const { data, error } = await supabase
      .from("fontes_confiaveis")
      .select("id, nome, url, tipo, ativo")
      .neq("nome", "Fato ou Boato")
      .order("nome", { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []).filter((source) => source.ativo !== false);
  }

  return all(
    `SELECT id, nome, url, tipo, ativo
    FROM fontes_confiaveis
    WHERE ativo = 1
      AND nome <> 'Fato ou Boato'
    ORDER BY nome ASC`
  );
}

async function getStats(clientId) {
  if (useSupabase) {
    let query = supabase
      .from("analises")
      .select("classificacao, modo");

    if (clientId) {
      query = query.eq("client_id", clientId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const rows = data || [];
    const byRiskMap = new Map();

    for (const row of rows) {
      const key = row.classificacao || "Sem classificação";
      byRiskMap.set(key, (byRiskMap.get(key) || 0) + 1);
    }

    return {
      total: rows.length,
      comGemini: rows.filter((row) => row.modo === "regras + Gemini").length,
      regrasLocais: rows.filter((row) => row.modo === "regras locais").length,
      porClassificacao: Array.from(byRiskMap, ([classificacao, total]) => ({ classificacao, total }))
    };
  }

  const params = [];
  const where = clientId ? "WHERE client_id = ?" : "";

  if (clientId) {
    params.push(clientId);
  }

  const totals = await all(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN modo = 'regras + Gemini' THEN 1 ELSE 0 END) AS com_gemini,
      SUM(CASE WHEN modo = 'regras locais' THEN 1 ELSE 0 END) AS regras_locais
    FROM analises
    ${where}
  `, params);
  const byRisk = await all(`
    SELECT classificacao, COUNT(*) AS total
    FROM analises
    ${where}
    GROUP BY classificacao
    ORDER BY total DESC
  `, params);

  return {
    total: totals[0].total || 0,
    comGemini: totals[0].com_gemini || 0,
    regrasLocais: totals[0].regras_locais || 0,
    porClassificacao: byRisk
  };
}

async function seedTrustedSourcesSupabase() {
  const { count, error: countError } = await supabase
    .from("fontes_confiaveis")
    .select("id", { count: "exact", head: true });

  if (countError) {
    throw countError;
  }

  if (count && count > 0) {
    return;
  }

  const { error } = await supabase.from("fontes_confiaveis").insert(
    trustedSourcesSeed.map(([nome, url, tipo]) => ({ nome, url, tipo }))
  );

  if (error) {
    throw error;
  }
}

async function seedKeywordsSupabase() {
  const { count, error: countError } = await supabase
    .from("palavras_chave")
    .select("id", { count: "exact", head: true });

  if (countError) {
    throw countError;
  }

  if (count && count > 0) {
    return;
  }

  const { error } = await supabase.from("palavras_chave").insert(
    keywordSeed.map(([palavra, categoria]) => ({ palavra, categoria }))
  );

  if (error) {
    throw error;
  }
}

module.exports = {
  initializeDatabase,
  saveAnalysis,
  getKeywordTerms,
  getHistory,
  getTrustedSources,
  getStats
};
