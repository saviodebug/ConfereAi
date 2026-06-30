/* global Tesseract, queryActiveTab, sendTabMessage, executeScriptFile, createTab, getExtensionUrl */

const VERCEL_BACKEND_URL = "https://confereaiextensao.vercel.app";
const BACKEND_URLS = [
  VERCEL_BACKEND_URL,
  "http://localhost:3000",
  "http://127.0.0.1:3000"
].filter(Boolean);
const MAX_IMAGE_SIZE_BYTES = 12 * 1024 * 1024;
const MAX_OCR_IMAGE_SIDE = 1800;
const MIN_TEXT_LENGTH = 30;
const OCR_FALLBACK_MIN_SCORE = 140;
const OCR_FALLBACK_MIN_WORDS = 8;

const analyzeBtn = document.getElementById("analyzeBtn");
const analyzePrintBtn = document.getElementById("analyzePrintBtn");
const healthBtn = document.getElementById("healthBtn");
const dashboardBtn = document.getElementById("dashboardBtn");
const copyReportBtn = document.getElementById("copyReportBtn");
const htmlReportBtn = document.getElementById("htmlReportBtn");
const fullHistoryBtn = document.getElementById("fullHistoryBtn");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const printInput = document.getElementById("printInput");
const pastePrintBox = document.getElementById("pastePrintBox");
const selectedPrintName = document.getElementById("selectedPrintName");
const notesInput = document.getElementById("notesInput");
const statusEl = document.getElementById("status");
const backendStatusEl = document.getElementById("backendStatus");
const resultEl = document.getElementById("result");
const ocrCard = document.getElementById("ocrCard");
const ocrTextEl = document.getElementById("ocrText");
const riskCard = document.getElementById("riskCard");
const classificationEl = document.getElementById("classification");
const scoreEl = document.getElementById("score");
const modeEl = document.getElementById("mode");
const geminiStatusEl = document.getElementById("geminiStatus");
const titleEl = document.getElementById("title");
const urlEl = document.getElementById("url");
const authorEl = document.getElementById("author");
const dateEl = document.getElementById("date");
const captureWarningEl = document.getElementById("captureWarning");
const capturedTextCard = document.getElementById("capturedTextCard");
const capturedTextEl = document.getElementById("capturedText");
const signalsEl = document.getElementById("signals");
const criteriaEl = document.getElementById("criteria");
const keywordsEl = document.getElementById("keywords");
const aiAnalysisEl = document.getElementById("aiAnalysis");
const sourcesEl = document.getElementById("sources");
const recommendationEl = document.getElementById("recommendation");
const historyEl = document.getElementById("history");
const statsEl = document.getElementById("stats");

let ocrWorkerPromise = null;
let pastedImageFile = null;
let lastReport = null;
let activeBackendUrl = null;
let operationActive = false;
let ocrStatusMessage = "2/4 Extraindo texto do print com OCR...";

analyzeBtn.addEventListener("click", analyzeCurrentPage);
analyzePrintBtn.addEventListener("click", analyzePrint);
healthBtn.addEventListener("click", checkBackendHealth);
dashboardBtn.addEventListener("click", openDashboard);
fullHistoryBtn.addEventListener("click", openDashboard);
clearHistoryBtn.addEventListener("click", clearHistory);
copyReportBtn.addEventListener("click", copyReport);
htmlReportBtn.addEventListener("click", generateHtmlReport);
printInput.addEventListener("change", handlePrintInputChange);
pastePrintBox.addEventListener("click", () => pastePrintBox.focus());
pastePrintBox.addEventListener("paste", handlePrintPaste);
document.addEventListener("paste", handlePrintPaste);

document.addEventListener("DOMContentLoaded", () => {
  checkBackendHealth();
  loadHistoryAndStats();
});

async function analyzeCurrentPage() {
  setLoading(analyzeBtn, true, "Analisando...", "Analisar página atual");
  beginOperation("1/3 Capturando título, link, autor, data e texto da notícia...");
  hideOcrText();

  try {
    const [tab] = await queryActiveTab();

    if (!tab || !tab.id) {
      throw new Error("Não foi possível identificar a aba ativa.");
    }

    const pageData = await capturePage(tab.id);
    pageData.captureWarning = getCaptureWarning(pageData);
    setStatus("2/3 Enviando conteúdo limpo para a API...");
    await sendToBackendAndRender(withNotes(pageData));
  } catch (error) {
    console.error(error);
    setBackendError();
  } finally {
    setLoading(analyzeBtn, false, "Analisando...", "Analisar página atual");
  }
}

async function analyzePrint() {
  const file = getSelectedPrintFile();

  if (!file) {
    setStatus("Escolha uma imagem ou use Ctrl+V para colar um print.");
    return;
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    setStatus("A imagem é muito grande. Use um arquivo de até 12 MB.");
    return;
  }

  setLoading(analyzePrintBtn, true, "Analisando...", "Analisar print");
  beginOperation("1/4 Lendo o print...");
  hideOcrText();

  try {
    const preparedImage = await prepareImageForOcr(file);

    ocrStatusMessage = "2/4 Extraindo texto do print com OCR...";
    setStatus(ocrStatusMessage);
    const extractedText = await extractBestTextFromImage(file, preparedImage);
    const cleanedText = extractedText.replace(/\s+/g, " ").trim();

    if (cleanedText.length < MIN_TEXT_LENGTH) {
      finishOperation("Não foi possível extrair texto suficiente do print. Tente uma imagem mais nítida.", "error");
      return;
    }

    showOcrText(cleanedText);
    setStatus("3/4 Enviando texto extraído para a API...");
    await sendToBackendAndRender(withNotes({
      titulo: "Texto extraído de print",
      url: "print enviado pelo usuário",
      texto: cleanedText,
      captureWarning: "",
      autor: "",
      data: ""
    }));
  } catch (error) {
    ocrWorkerPromise = null;
    console.error(error);
    finishOperation("Não foi possível fazer OCR neste print. Tente outra imagem mais nítida.", "error");
  } finally {
    setLoading(analyzePrintBtn, false, "Analisando...", "Analisar print");
  }
}

function withNotes(payload) {
  return {
    ...payload,
    clientId: getClientId(),
    observacoes: notesInput.value.trim()
  };
}

async function sendToBackendAndRender(payload) {
  setStatus("IA e regras analisando sinais de risco. Isso pode levar alguns segundos...");
  const response = await requestBackend("/analisar", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Backend retornou HTTP ${response.status}.`);
  }

  const result = await response.json();
  renderResult(payload, result);
  await loadHistoryAndStats();
  finishOperation("Análise concluída.", "success");
}

async function checkBackendHealth() {
  try {
    const response = await requestBackend("/health");

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const health = await response.json();
    backendStatusEl.textContent = `Backend ok em ${activeBackendUrl}. Modo: ${health.modo}. Gemini configurado: ${health.geminiConfigurado ? "sim" : "não"}.`;
  } catch (error) {
    backendStatusEl.textContent = "Backend indisponível. Rode npm run dev na pasta backend, confirme o IP de rede e recarregue a extensão.";
  }
}

async function loadHistoryAndStats() {
  try {
    const [historyResponse, statsResponse] = await Promise.all([
      requestBackend(`/historico?clientId=${encodeURIComponent(getClientId())}`),
      requestBackend(`/estatisticas?clientId=${encodeURIComponent(getClientId())}`)
    ]);

    if (historyResponse.ok) {
      renderHistory(await historyResponse.json());
    }

    if (statsResponse.ok) {
      renderStats(await statsResponse.json());
    }
  } catch (error) {
    historyEl.replaceChildren(createListItem("Histórico indisponível enquanto o backend não estiver rodando."));
    statsEl.replaceChildren();
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

async function capturePage(tabId) {
  try {
    return await sendCaptureMessage(tabId);
  } catch (error) {
    await executeScriptFile(tabId, "content.js");

    return sendCaptureMessage(tabId);
  }
}

async function sendCaptureMessage(tabId) {
  const response = await sendTabMessage(tabId, { type: "CONFEREAI_CAPTURE" });

  if (!response) {
    throw new Error("A página não retornou dados.");
  }

  return response;
}

function handlePrintInputChange() {
  pastedImageFile = null;
  pastePrintBox.classList.remove("has-image");

  const file = printInput.files && printInput.files[0];
  selectedPrintName.textContent = file ? `Imagem selecionada: ${file.name}` : "Nenhuma imagem selecionada.";
}

function handlePrintPaste(event) {
  const items = event.clipboardData && event.clipboardData.items;

  if (!items) {
    return;
  }

  for (const item of items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();

      if (!file) {
        return;
      }

      pastedImageFile = file;
      setPrintInputFile(file);
      pastePrintBox.classList.add("has-image");
      selectedPrintName.textContent = "Print colado da área de transferência. Você já pode clicar em Analisar print.";
      setStatus("Print colado. Clique em Analisar print.");
      event.preventDefault();
      return;
    }
  }
}

function setPrintInputFile(file) {
  try {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    printInput.files = transfer.files;
  } catch (error) {
    printInput.value = "";
  }
}

function getSelectedPrintFile() {
  if (pastedImageFile) {
    return pastedImageFile;
  }

  return printInput.files && printInput.files[0];
}

function prepareImageForOcr(file) {
  return new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      try {
        const scale = Math.min(1, MAX_OCR_IMAGE_SIDE / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { willReadFrequently: true });

        canvas.width = width;
        canvas.height = height;
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        improveImageContrast(context, width, height);

        canvas.toBlob((blob) => {
          URL.revokeObjectURL(imageUrl);

          if (!blob) {
            reject(new Error("Não foi possível preparar a imagem para OCR."));
            return;
          }

          resolve(blob);
        }, "image/png");
      } catch (error) {
        URL.revokeObjectURL(imageUrl);
        reject(error);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error("Falha ao carregar a imagem enviada."));
    };

    image.src = imageUrl;
  });
}

function improveImageContrast(context, width, height) {
  const imageData = context.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  for (let index = 0; index < pixels.length; index += 4) {
    const gray = pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114;
    const adjusted = gray > 170 ? 255 : gray < 95 ? 0 : gray;

    pixels[index] = adjusted;
    pixels[index + 1] = adjusted;
    pixels[index + 2] = adjusted;
  }

  context.putImageData(imageData, 0, 0);
}

async function extractBestTextFromImage(originalImage, preparedImage) {
  const preparedText = await extractTextFromImage(preparedImage);

  if (isOcrTextGoodEnough(preparedText)) {
    return preparedText;
  }

  ocrStatusMessage = "2/4 Tentando melhorar a leitura do print com OCR avançado...";
  setStatus(ocrStatusMessage);
  const originalText = await extractTextFromImage(originalImage);

  return scoreOcrText(preparedText) > scoreOcrText(originalText) ? preparedText : originalText;
}

async function extractTextFromImage(image) {
  const worker = await getOcrWorker();
  const result = await worker.recognize(image);
  return result.data.text || "";
}

function scoreOcrText(text) {
  const cleanText = String(text || "").replace(/\s+/g, " ").trim();
  const letterCount = (cleanText.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  const wordCount = (cleanText.match(/\b[A-Za-zÀ-ÿ]{3,}\b/g) || []).length;
  const replacementNoise = (cleanText.match(/[|_~^`{}[\]\\]/g) || []).length;

  return letterCount + wordCount * 4 - replacementNoise * 6;
}

function isOcrTextGoodEnough(text) {
  const cleanText = String(text || "").replace(/\s+/g, " ").trim();
  const wordCount = (cleanText.match(/\b[A-Za-zÀ-ÿ]{3,}\b/g) || []).length;

  return cleanText.length >= MIN_TEXT_LENGTH &&
    wordCount >= OCR_FALLBACK_MIN_WORDS &&
    scoreOcrText(cleanText) >= OCR_FALLBACK_MIN_SCORE;
}

function getOcrWorker() {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = Tesseract.createWorker("por+eng", 1, {
      workerPath: getExtensionUrl("vendor/tesseract/worker.min.js"),
      corePath: getExtensionUrl("vendor/tesseract/core"),
      langPath: getExtensionUrl("vendor/tesseract/lang-data/"),
      workerBlobURL: false,
      cacheMethod: "none",
      logger: handleOcrProgress
    });
  }

  return ocrWorkerPromise;
}

function handleOcrProgress(message) {
  if (message.status === "recognizing text" && typeof message.progress === "number") {
    setStatus(`${ocrStatusMessage} ${Math.round(message.progress * 100)}%`);
  }
}

function renderResult(pageData, result) {
  resultEl.classList.remove("hidden");

  riskCard.classList.remove("risk-low", "risk-medium", "risk-high");
  riskCard.classList.add(getRiskClass(result.classificacao));

  classificationEl.textContent = result.classificacao || "-";
  scoreEl.textContent = `Pontuação: ${result.pontuacao ?? "-"}`;
  modeEl.textContent = `Modo: ${result.modo || "regras locais"}`;
  geminiStatusEl.textContent = `Gemini: ${result.geminiStatus || "sem diagnóstico"}`;
  titleEl.textContent = pageData.titulo || "-";
  urlEl.textContent = pageData.url || "-";
  urlEl.href = String(pageData.url || "").startsWith("http") ? pageData.url : "#";
  authorEl.textContent = result.autor || pageData.autor || "-";
  dateEl.textContent = result.data || pageData.data || "-";
  renderCaptureWarning(pageData.captureWarning);
  renderCapturedText(pageData.texto);
  aiAnalysisEl.textContent = result.analiseIA || "A análise da IA não foi usada nesta execução.";
  recommendationEl.textContent = result.recomendacao || "-";

  renderList(signalsEl, result.sinais || []);
  renderCriteria(result.criterios || []);
  renderKeywords(result.palavrasChave || []);
  renderSources(result.fontesSugeridas || []);

  lastReport = { payload: pageData, result };
  scrollToResult();
}

function renderCapturedText(text) {
  const cleanText = String(text || "").replace(/\s+/g, " ").trim();
  capturedTextEl.textContent = cleanText || "Nenhum texto capturado.";
  capturedTextCard.classList.toggle("hidden", !cleanText);
}

function renderList(element, items) {
  element.replaceChildren();

  if (!items.length) {
    element.appendChild(createListItem("Nenhum sinal específico foi retornado."));
    return;
  }

  items.forEach((text) => {
    element.appendChild(createListItem(text));
  });
}

function renderCriteria(criteria) {
  criteriaEl.replaceChildren();

  criteria.forEach((criterion) => {
    const row = document.createElement("tr");
    appendTableCell(row, criterion.criterio);
    appendTableCell(row, criterion.ativo ? "Aplicado" : "Não aplicado");
    appendTableCell(row, criterion.pontos > 0 ? `+${criterion.pontos}` : criterion.pontos);
    criteriaEl.appendChild(row);
  });
}

function renderKeywords(keywords) {
  keywordsEl.replaceChildren();

  if (!keywords.length) {
    const empty = document.createElement("span");
    empty.className = "chip";
    empty.textContent = "Nenhuma palavra-chave detectada";
    keywordsEl.appendChild(empty);
    return;
  }

  keywords.forEach((keyword) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = keyword;
    keywordsEl.appendChild(chip);
  });
}

function renderSources(sources) {
  sourcesEl.replaceChildren();

  sources.slice(0, 6).forEach((source) => {
    const wrapper = document.createElement("a");
    wrapper.className = "source-link";
    wrapper.href = source.url;
    wrapper.target = "_blank";
    wrapper.rel = "noreferrer";

    const name = document.createElement("strong");
    name.textContent = source.nome;

    const type = document.createElement("span");
    type.textContent = source.tipo;

    wrapper.append(name, type);
    sourcesEl.appendChild(wrapper);
  });
}

function renderHistory(items) {
  historyEl.replaceChildren();

  if (!items.length) {
    historyEl.appendChild(createListItem("Nenhuma análise salva ainda."));
    return;
  }

  items.slice(0, 2).forEach((item) => {
    const li = document.createElement("li");
    const title = document.createElement("span");
    title.className = "history-title";
    title.textContent = item.titulo || "Sem título";

    const meta = document.createElement("span");
    meta.className = "history-meta";
    meta.textContent = `${item.classificacao || "Sem classificação"} | Pontuação: ${item.pontuacao ?? "-"} | ${formatHistoryDate(item.createdAt)}`;

    li.append(title, meta);
    historyEl.appendChild(li);
  });
}

function getCaptureWarning(pageData) {
  const text = String(pageData.texto || "").replace(/\s+/g, " ").trim();
  const wordCount = text ? text.split(/\s+/).length : 0;

  if (wordCount < 80) {
    return "A extensão encontrou pouco texto da notícia. Tente abrir a matéria completa antes de analisar.";
  }

  if (!pageData.autor || !pageData.data) {
    return "A captura pode estar incompleta: autor ou data não foram encontrados na página.";
  }

  return "";
}

function renderCaptureWarning(message) {
  captureWarningEl.textContent = message || "";
  captureWarningEl.classList.toggle("hidden", !message);
}

function formatHistoryDate(value) {
  if (!value) {
    return "";
  }

  return String(value).slice(0, 10);
}

function renderStats(stats) {
  statsEl.replaceChildren(
    createStat(stats.total || 0, "Total"),
    createStat(stats.comGemini || 0, "Com Gemini"),
    createStat(stats.regrasLocais || 0, "Regras locais")
  );
}

async function clearHistory() {
  const confirmed = confirm("Limpar o histórico desta instalação do ConfereAí?");

  if (!confirmed) {
    return;
  }

  setLoading(clearHistoryBtn, true, "Limpando...", "Limpar histórico");

  try {
    const response = await requestBackend(`/historico?clientId=${encodeURIComponent(getClientId())}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      throw new Error(`Backend retornou HTTP ${response.status}.`);
    }

    await loadHistoryAndStats();
    setStatus("Histórico limpo nesta instalação.", "success");
  } catch (error) {
    console.error(error);
    setStatus("Não foi possível limpar o histórico agora.", "error");
  } finally {
    setLoading(clearHistoryBtn, false, "Limpando...", "Limpar histórico");
  }
}

function createListItem(text) {
  const item = document.createElement("li");
  item.textContent = text;
  return item;
}

function appendTableCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value;
  row.appendChild(cell);
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

async function copyReport() {
  if (!lastReport) {
    setStatus("Faça uma análise antes de copiar o relatório.");
    return;
  }

  await navigator.clipboard.writeText(buildPlainReport(lastReport));
  setStatus("Relatório copiado.");
}

function generateHtmlReport() {
  if (!lastReport) {
    setStatus("Faça uma análise antes de gerar o relatório.");
    return;
  }

  const html = buildHtmlReport(lastReport);
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  createTab(url);
}

function openDashboard() {
  createTab(getExtensionUrl("dashboard.html"));
}

function buildPlainReport(report) {
  const { payload, result } = report;

  return [
    "ConfereAí",
    `Título: ${payload.titulo}`,
    `URL: ${payload.url}`,
    `Autor: ${result.autor || payload.autor || "-"}`,
    `Data: ${result.data || payload.data || "-"}`,
    `Classificação: ${result.classificacao}`,
    `Pontuação: ${result.pontuacao}`,
    `Modo: ${result.modo}`,
    `Gemini: ${result.geminiStatus || "-"}`,
    "",
    "Sinais:",
    ...(result.sinais || []).map((signal) => `- ${signal}`),
    "",
    "Palavras-chave:",
    (result.palavrasChave || []).join(", ") || "Nenhuma",
    "",
    "Análise da IA:",
    result.analiseIA || "Não usada nesta execução.",
    "",
    "Recomendação:",
    result.recomendacao || "",
    "",
    "Aviso:",
    result.aviso || ""
  ].join("\n");
}

function buildHtmlReport(report) {
  const plain = buildPlainReport(report);

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Relatório ConfereAí</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; color: #172033; }
    pre { white-space: pre-wrap; line-height: 1.45; }
    button { margin-bottom: 16px; padding: 10px 14px; }
  </style>
</head>
<body>
  <button onclick="window.print()">Imprimir ou salvar em PDF</button>
  <pre>${escapeHtml(plain)}</pre>
</body>
</html>`;
}

function showOcrText(text) {
  ocrCard.classList.remove("hidden");
  ocrTextEl.textContent = text;
}

function hideOcrText() {
  ocrCard.classList.add("hidden");
  ocrTextEl.textContent = "";
}

function getRiskClass(classificacao) {
  const value = String(classificacao || "").toLowerCase();

  if (value.includes("alto")) {
    return "risk-high";
  }

  if (value.includes("médio") || value.includes("medio")) {
    return "risk-medium";
  }

  return "risk-low";
}

function setLoading(button, isLoading, loadingText, idleText) {
  button.disabled = isLoading;
  button.textContent = isLoading ? loadingText : idleText;
}

function beginOperation(message) {
  operationActive = true;
  setStatus(message);
}

function finishOperation(message, type) {
  operationActive = false;
  setStatus(message, type);
}

function setStatus(message, type = "info") {
  statusEl.textContent = message;
  statusEl.classList.toggle("has-message", Boolean(message));
  statusEl.classList.toggle("is-busy", operationActive);
  statusEl.classList.toggle("is-success", type === "success");
  statusEl.classList.toggle("is-error", type === "error");
}

function setBackendError() {
  finishOperation("Não foi possível conectar ao backend. Verifique se o servidor está rodando na porta 3000, se o IP de rede está configurado e clique em Verificar backend.", "error");
}

function scrollToResult() {
  requestAnimationFrame(() => {
    riskCard.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
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
