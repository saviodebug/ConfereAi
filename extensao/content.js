// Executa dentro da página atual e envia ao popup apenas dados visíveis da aba.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "VERIFICAVOTO_AI_CAPTURE") {
    sendResponse(capturePageData());
  }
});

function capturePageData() {
  const visibleText = getVisibleText();

  return {
    titulo: document.title || getMetaContent("og:title") || "Título não encontrado",
    url: window.location.href,
    texto: visibleText.slice(0, 8000),
    autor: findAuthor(visibleText),
    data: findDate(visibleText)
  };
}

function getVisibleText() {
  return (document.body ? document.body.innerText : "")
    .replace(/\s+/g, " ")
    .trim();
}

function getMetaContent(name) {
  const element = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
  return element ? element.getAttribute("content") || "" : "";
}

function findAuthor(text) {
  const metaAuthor =
    getMetaContent("author") ||
    getMetaContent("article:author") ||
    getMetaContent("byl");

  if (metaAuthor) {
    return metaAuthor.trim().slice(0, 160);
  }

  const authorPatterns = [
    /\b[Pp]or\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][^.!?\n\r]{3,180}/,
    /\b[Aa]utor(?:a)?\s*[:\-]\s*[^.!?\n\r]{3,120}/,
    /\b[Pp]ublicado por\s+[^.!?\n\r]{3,120}/
  ];

  for (const pattern of authorPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0].replace(/\s+/g, " ").trim().slice(0, 160);
    }
  }

  return "";
}

function findDate(text) {
  const metaDate =
    getMetaContent("article:published_time") ||
    getMetaContent("article:modified_time") ||
    getMetaContent("date") ||
    getMetaContent("pubdate");

  if (metaDate) {
    return metaDate.trim();
  }

  const timeElement = document.querySelector("time[datetime], time");
  if (timeElement) {
    return (timeElement.getAttribute("datetime") || timeElement.textContent || "").trim();
  }

  const datePatterns = [
    /\b\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*\d{2,4}\b/,
    /\b\d{1,2}\s+de\s+(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+\d{4}\b/i,
    /\b20\d{2}\s*-\s*\d{1,2}\s*-\s*\d{1,2}\b/
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0].replace(/\s+/g, " ").trim();
    }
  }

  return "";
}
