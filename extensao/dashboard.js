const VERCEL_BACKEND_URL = "https://confereaiextensao.vercel.app";
const BACKEND_URLS = [
  VERCEL_BACKEND_URL,
  "http://localhost:3000",
  "http://127.0.0.1:3000"
].filter(Boolean);

const refreshBtn = document.getElementById("refreshBtn");
const statusEl = document.getElementById("status");
const statsEl = document.getElementById("stats");
const sourcesEl = document.getElementById("sources");
const historyEl = document.getElementById("history");

let activeBackendUrl = null;

refreshBtn.addEventListener("click", loadDashboard);
document.addEventListener("DOMContentLoaded", loadDashboard);

async function loadDashboard() {
  statusEl.textContent = "Carregando dados...";

  try {
    const [statsResponse, sourcesResponse, historyResponse] = await Promise.all([
      requestBackend(`/estatisticas?clientId=${encodeURIComponent(getClientId())}`),
      requestBackend("/fontes"),
      requestBackend(`/historico?clientId=${encodeURIComponent(getClientId())}`)
    ]);

    if (!statsResponse.ok || !sourcesResponse.ok || !historyResponse.ok) {
      throw new Error("Backend retornou erro.");
    }

    renderStats(await statsResponse.json());
    renderSources(await sourcesResponse.json());
    renderHistory(await historyResponse.json());
    statusEl.textContent = `Dados atualizados de ${activeBackendUrl}.`;
  } catch (error) {
    statusEl.textContent = "Não foi possível carregar o dashboard. Verifique se o backend está rodando na porta 3000 e se o IP de rede está acessível.";
  }
}

async function requestBackend(path, options) {
  const urls = activeBackendUrl
    ? [activeBackendUrl, ...BACKEND_URLS.filter((url) => url !== activeBackendUrl)]
    : BACKEND_URLS;
  let lastError;

  for (const baseUrl of urls) {
    try {
      const requestOptions = {
        ...(options || {}),
        headers: {
          ...(options && options.headers ? options.headers : {}),
          "X-Confereai-Client-Id": getClientId()
        }
      };
      const response = await fetch(`${baseUrl}${path}`, requestOptions);
      activeBackendUrl = baseUrl;
      return response;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Nenhum backend configurado.");
}

function getClientId() {
  const storageKey = "confereaiClientId";
  let clientId = localStorage.getItem(storageKey);

  if (!clientId) {
    clientId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  }

  localStorage.setItem(storageKey, clientId);
  return clientId;
}

function renderStats(stats) {
  statsEl.replaceChildren(
    createStat(stats.total || 0, "Total"),
    createStat(stats.comGemini || 0, "Com Gemini"),
    createStat(stats.regrasLocais || 0, "Regras locais")
  );
}

function renderSources(sources) {
  sourcesEl.replaceChildren();

  sources.forEach((source) => {
    const item = document.createElement("div");
    item.className = "source";

    const link = document.createElement("a");
    link.href = source.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = source.nome;

    const type = document.createElement("span");
    type.textContent = source.tipo;

    item.append(link, type);
    sourcesEl.appendChild(item);
  });
}

function renderHistory(history) {
  historyEl.replaceChildren();

  if (!history.length) {
    historyEl.textContent = "Nenhuma análise salva ainda.";
    return;
  }

  history.forEach((analysis) => {
    const item = document.createElement("details");
    item.className = "history-item";

    const summary = document.createElement("summary");
    const summaryContent = document.createElement("span");

    const title = document.createElement("h3");
    title.textContent = analysis.titulo || "Sem título";

    const meta = document.createElement("small");
    meta.textContent = `${analysis.createdAt || ""} | ${analysis.modo || ""}`;

    const score = document.createElement("p");
    const classification = document.createElement("strong");
    classification.textContent = analysis.classificacao || "";
    score.append(classification, ` | Pontuação: ${analysis.pontuacao ?? "-"}`);

    summaryContent.append(title, meta, score);
    summary.appendChild(summaryContent);
    item.appendChild(summary);

    const details = document.createElement("div");
    details.className = "history-details";

    appendDetail(details, "URL", analysis.url || "Não informada", analysis.url);
    appendDetail(details, "Texto analisado", analysis.textoResumo || "Sem resumo salvo.");

    const signals = document.createElement("p");
    signals.textContent = (analysis.sinais || []).join(" ");
    appendDetail(details, "Sinais encontrados", signals.textContent || "Nenhum sinal retornado.");

    appendListDetail(details, "Critérios", analysis.criterios || [], formatCriterion);
    appendListDetail(details, "Palavras-chave", analysis.palavrasChave || [], (keyword) => keyword);
    appendDetail(details, "Análise da IA", analysis.analiseIA || "Não usada nesta execução.");
    appendDetail(details, "Gemini", analysis.geminiStatus || "Sem diagnóstico.");

    if (analysis.observacoes) {
      appendDetail(details, "Observações", analysis.observacoes);
    }

    item.appendChild(details);
    historyEl.appendChild(item);
  });
}

function appendDetail(parent, label, value, href) {
  const wrapper = document.createElement("section");
  wrapper.className = "detail-block";

  const title = document.createElement("strong");
  title.textContent = label;

  const content = href && String(href).startsWith("http")
    ? document.createElement("a")
    : document.createElement("p");

  if (content.tagName === "A") {
    content.href = href;
    content.target = "_blank";
    content.rel = "noreferrer";
  }

  content.textContent = value;
  wrapper.append(title, content);
  parent.appendChild(wrapper);
}

function appendListDetail(parent, label, items, formatter) {
  if (!items.length) {
    appendDetail(parent, label, "Nenhum item registrado.");
    return;
  }

  const wrapper = document.createElement("section");
  wrapper.className = "detail-block";

  const title = document.createElement("strong");
  title.textContent = label;

  const list = document.createElement("ul");
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = formatter(item);
    list.appendChild(li);
  });

  wrapper.append(title, list);
  parent.appendChild(wrapper);
}

function formatCriterion(criterion) {
  const points = criterion.pontos > 0 ? `+${criterion.pontos}` : criterion.pontos;
  return `${criterion.criterio}: ${criterion.ativo ? "aplicado" : "não aplicado"} (${points})`;
}

function createStat(value, label) {
  const stat = document.createElement("div");
  stat.className = "stat";

  const number = document.createElement("strong");
  number.textContent = value;

  const text = document.createElement("span");
  text.textContent = label;

  stat.append(number, text);
  return stat;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
