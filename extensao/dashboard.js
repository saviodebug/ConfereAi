const SHARED_BACKEND_URL = "http://192.168.0.24:3000";
const BACKEND_URLS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  SHARED_BACKEND_URL
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
      requestBackend("/estatisticas"),
      requestBackend("/fontes"),
      requestBackend("/historico")
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
      const response = await fetch(`${baseUrl}${path}`, options);
      activeBackendUrl = baseUrl;
      return response;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Nenhum backend configurado.");
}

function renderStats(stats) {
  statsEl.innerHTML = `
    <div class="stat"><strong>${stats.total || 0}</strong><span>Total</span></div>
    <div class="stat"><strong>${stats.comGemini || 0}</strong><span>Com Gemini</span></div>
    <div class="stat"><strong>${stats.regrasLocais || 0}</strong><span>Regras locais</span></div>
  `;
}

function renderSources(sources) {
  sourcesEl.innerHTML = "";

  sources.forEach((source) => {
    const item = document.createElement("div");
    item.className = "source";
    item.innerHTML = `
      <a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.nome)}</a>
      <span>${escapeHtml(source.tipo)}</span>
    `;
    sourcesEl.appendChild(item);
  });
}

function renderHistory(history) {
  historyEl.innerHTML = "";

  if (!history.length) {
    historyEl.textContent = "Nenhuma análise salva ainda.";
    return;
  }

  history.forEach((analysis) => {
    const item = document.createElement("article");
    item.className = "history-item";
    item.innerHTML = `
      <h3>${escapeHtml(analysis.titulo || "Sem título")}</h3>
      <small>${escapeHtml(analysis.createdAt || "")} | ${escapeHtml(analysis.modo || "")}</small>
      <p><strong>${escapeHtml(analysis.classificacao || "")}</strong> | Pontuação: ${analysis.pontuacao ?? "-"}</p>
      <p>${escapeHtml((analysis.sinais || []).join(" "))}</p>
      ${analysis.observacoes ? `<p><strong>Observações:</strong> ${escapeHtml(analysis.observacoes)}</p>` : ""}
    `;
    historyEl.appendChild(item);
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
