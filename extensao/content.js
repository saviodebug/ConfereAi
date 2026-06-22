/* global browser, chrome */

const runtimeApi = globalThis.browser || globalThis.chrome;
const MAX_CAPTURED_TEXT_LENGTH = 8000;
const ARTICLE_SELECTORS = [
  "article",
  "main article",
  "[role='main'] article",
  "[itemtype*='NewsArticle']",
  "[itemtype*='Article']",
  "[class*='article']",
  "[class*='materia']",
  "[class*='noticia']",
  "[class*='news']",
  "[class*='post-content']",
  "[class*='content-body']",
  "[class*='story']",
  "main"
];
const NOISE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "svg",
  "canvas",
  "iframe",
  "form",
  "input",
  "button",
  "select",
  "textarea",
  "nav",
  "header",
  "footer",
  "aside",
  "[role='navigation']",
  "[role='banner']",
  "[role='contentinfo']",
  "[aria-label*='menu' i]",
  "[aria-label*='login' i]",
  "[class*='menu' i]",
  "[class*='nav' i]",
  "[class*='header' i]",
  "[class*='footer' i]",
  "[class*='sidebar' i]",
  "[class*='share' i]",
  "[class*='social' i]",
  "[class*='newsletter' i]",
  "[class*='comment' i]",
  "[class*='cookie' i]",
  "[class*='ad-' i]",
  "[class*='advert' i]",
  "[class*='publicidade' i]",
  "[id*='menu' i]",
  "[id*='login' i]",
  "[id*='cookie' i]",
  "[id*='ad-' i]"
];
const NOISE_TEXT_PATTERNS = [
  /entrar com conta/i,
  /criar uma conta/i,
  /utilize o mesmo login/i,
  /aceitar cookies/i,
  /política de privacidade/i,
  /compartilhe/i,
  /assine/i,
  /newsletter/i,
  /publicidade/i
];

runtimeApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "CONFEREAI_CAPTURE") {
    sendResponse(capturePageData());
  }
});

function capturePageData() {
  const article = extractArticle();
  const structuredData = getStructuredArticleData();
  const title = getTitle(article.element, structuredData);
  const subtitle = getSubtitle(article.element);
  const contextText = getArticleContextText(article.element);
  const author = findAuthor(article.text, article.element, structuredData, contextText);
  const date = findDate(article.text, article.element, structuredData, contextText);
  const canonicalUrl = getCanonicalUrl();
  const textParts = [subtitle, article.text].filter(Boolean);

  return {
    titulo: title || "Título não encontrado",
    url: canonicalUrl || window.location.href,
    texto: textParts.join("\n\n").slice(0, MAX_CAPTURED_TEXT_LENGTH),
    metadadosTexto: contextText,
    autor: author,
    data: date
  };
}

function extractArticle() {
  const candidates = collectArticleCandidates()
    .map((element) => ({
      element,
      text: getArticleText(element),
      score: scoreArticleCandidate(element)
    }))
    .filter((candidate) => candidate.text.length >= 160)
    .sort((a, b) => b.score - a.score);

  if (candidates.length) {
    return {
      element: candidates[0].element,
      text: candidates[0].text
    };
  }

  return {
    element: document.body,
    text: getArticleText(document.body)
  };
}

function collectArticleCandidates() {
  const candidates = new Set();

  ARTICLE_SELECTORS.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => candidates.add(element));
  });

  const heading = document.querySelector("h1");
  const headingContainer = heading && heading.closest("article, main, [role='main'], [class*='article'], [class*='materia'], [class*='noticia']");

  if (headingContainer) {
    candidates.add(headingContainer);
  }

  if (document.body) {
    candidates.add(document.body);
  }

  return Array.from(candidates);
}

function getArticleText(element) {
  if (!element) {
    return "";
  }

  const clone = element.cloneNode(true);
  removeNoise(clone);

  const blocks = Array.from(clone.querySelectorAll("p, h2, h3, li, blockquote"))
    .map((node) => normalizeText(node.textContent))
    .filter(isUsefulTextBlock);
  const usefulBlocks = blocks.length ? blocks : [normalizeText(clone.textContent)].filter(Boolean);

  return uniqueTexts(usefulBlocks).join("\n\n").slice(0, MAX_CAPTURED_TEXT_LENGTH);
}

function removeNoise(root) {
  NOISE_SELECTORS.forEach((selector) => {
    root.querySelectorAll(selector).forEach((element) => element.remove());
  });
}

function isUsefulTextBlock(text) {
  if (!text || text.length < 35) {
    return false;
  }

  if (!/[.!?…:]$/.test(text) && text.length < 90) {
    return false;
  }

  if (NOISE_TEXT_PATTERNS.some((pattern) => pattern.test(text))) {
    return false;
  }

  const words = text.split(/\s+/).filter(Boolean);
  return words.length >= 6;
}

function scoreArticleCandidate(element) {
  const text = getArticleText(element);
  const paragraphCount = element.querySelectorAll("p").length;
  const headingScore = element.querySelector("h1") ? 180 : 0;
  const articleScore = element.matches("article, [itemtype*='Article'], [itemtype*='NewsArticle']") ? 220 : 0;
  const mainScore = element.matches("main, [role='main']") ? 80 : 0;
  const textScore = Math.min(text.length, 6000);
  const noisePenalty = element === document.body ? 900 : 0;

  return textScore + paragraphCount * 45 + headingScore + articleScore + mainScore - noisePenalty;
}

function getTitle(articleElement, structuredData) {
  const candidates = [
    structuredData.headline,
    articleElement && getFirstText(articleElement, "h1"),
    getMetaContent("og:title"),
    getMetaContent("twitter:title"),
    document.title
  ];

  return cleanTitle(candidates.find(Boolean) || "");
}

function getSubtitle(articleElement) {
  const selectors = [
    "[class*='subtitulo' i]",
    "[class*='subtitle' i]",
    "[class*='standfirst' i]",
    "[class*='summary' i]",
    "[class*='description' i]",
    "h2"
  ];
  const localSubtitle = articleElement
    ? selectors.map((selector) => getFirstText(articleElement, selector)).find(Boolean)
    : "";
  const metaSubtitle =
    getMetaContent("og:description") ||
    getMetaContent("twitter:description") ||
    getMetaContent("description");

  return normalizeText(localSubtitle || metaSubtitle).slice(0, 500);
}

function getCanonicalUrl() {
  const canonical = document.querySelector("link[rel='canonical']");
  const href = canonical ? canonical.getAttribute("href") : "";

  if (!href) {
    return "";
  }

  try {
    return new URL(href, window.location.href).href;
  } catch (error) {
    return "";
  }
}

function getStructuredArticleData() {
  const result = {
    headline: "",
    author: "",
    datePublished: "",
    dateModified: ""
  };
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));

  scripts.forEach((script) => {
    const article = parseJsonLd(script.textContent).find(isArticleJsonLd);

    if (!article) {
      return;
    }

    result.headline = result.headline || normalizeText(article.headline || article.name);
    result.author = result.author || normalizeAuthorValue(article.author || article.creator);
    result.datePublished = result.datePublished || normalizeText(article.datePublished || article.dateCreated);
    result.dateModified = result.dateModified || normalizeText(article.dateModified || article.dateUpdated);
  });

  return result;
}

function parseJsonLd(value) {
  try {
    return flattenJsonLd(JSON.parse(value || ""));
  } catch (error) {
    return [];
  }
}

function flattenJsonLd(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(flattenJsonLd);
  }

  if (typeof value === "object") {
    return [
      value,
      ...flattenJsonLd(value["@graph"])
    ];
  }

  return [];
}

function isArticleJsonLd(value) {
  const type = value && value["@type"];
  const types = Array.isArray(type) ? type : [type];

  return types.some((item) => /Article|NewsArticle|ReportageNewsArticle|BlogPosting/i.test(String(item || "")));
}

function normalizeAuthorValue(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return cleanAuthor(value);
  }

  if (Array.isArray(value)) {
    return value.map(normalizeAuthorValue).filter(Boolean).join(", ").slice(0, 160);
  }

  if (typeof value === "object") {
    return cleanAuthor(value.name || value.url || "");
  }

  return "";
}

function getMetaContent(name) {
  const element = document.querySelector(`meta[name="${cssEscape(name)}"], meta[property="${cssEscape(name)}"]`);
  return element ? element.getAttribute("content") || "" : "";
}

function getFirstText(root, selector) {
  const element = root && root.querySelector(selector);
  return element ? normalizeText(element.textContent) : "";
}

function findAuthor(text, articleElement, structuredData, contextText) {
  if (structuredData.author) {
    return structuredData.author.slice(0, 160);
  }

  const metaAuthor =
    getMetaContent("author") ||
    getMetaContent("article:author") ||
    getMetaContent("byl") ||
    getMetaContent("parsely-author") ||
    getMetaContent("cXenseParse:author");

  if (metaAuthor) {
    return cleanAuthor(metaAuthor).slice(0, 160);
  }

  const authorSelectors = [
    "[rel='author']",
    "[class*='author' i]",
    "[class*='autor' i]",
    "[class*='byline' i]",
    "[itemprop='author']",
    "[data-testid*='author' i]"
  ];
  const authorFromPage = authorSelectors
    .map((selector) => getFirstText(articleElement || document, selector))
    .find((value) => value && value.length <= 180);

  if (authorFromPage) {
    return cleanAuthor(authorFromPage).slice(0, 160);
  }

  const authorPatterns = [
    /\b[Pp]or\s+[^.!?\n\r]{3,180}(?=(?:\s+\d{1,2}\/\d{1,2}\/\d{2,4})|(?:\s+Atualizado)|(?:\s+\d{1,2}h\d{0,2})|$)/,
    /\b[Pp]or\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][^.!?\n\r]{3,180}/,
    /\b[Rr]edação\s+[^.!?\n\r]{1,80}/,
    /\b[Aa]utor(?:a)?\s*[:\-]\s*[^.!?\n\r]{3,120}/,
    /\b[Pp]ublicado por\s+[^.!?\n\r]{3,120}/
  ];

  for (const sourceText of [contextText, text].filter(Boolean)) {
    for (const pattern of authorPatterns) {
      const match = sourceText.match(pattern);
      if (match) {
        return cleanAuthor(match[0]).slice(0, 160);
      }
    }
  }

  return "";
}

function findDate(text, articleElement, structuredData, contextText) {
  const structuredDate = structuredData.datePublished || structuredData.dateModified;

  if (structuredDate) {
    return structuredDate.slice(0, 120);
  }

  const metaDate =
    getMetaContent("article:published_time") ||
    getMetaContent("article:modified_time") ||
    getMetaContent("datePublished") ||
    getMetaContent("dateModified") ||
    getMetaContent("date") ||
    getMetaContent("pubdate");

  if (metaDate) {
    return normalizeText(metaDate).slice(0, 120);
  }

  const timeElement = articleElement
    ? articleElement.querySelector("time[datetime], time")
    : document.querySelector("time[datetime], time");

  if (timeElement) {
    return normalizeText(timeElement.getAttribute("datetime") || timeElement.textContent || "").slice(0, 120);
  }

  const datePatterns = [
    /\b\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*\d{2,4}(?:\s+\d{1,2}h\d{0,2})?\b/,
    /\b\d{1,2}\s+de\s+(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+\d{4}\b/i,
    /\b20\d{2}\s*-\s*\d{1,2}\s*-\s*\d{1,2}\b/
  ];

  for (const sourceText of [contextText, text].filter(Boolean)) {
    for (const pattern of datePatterns) {
      const match = sourceText.match(pattern);
      if (match) {
        return normalizeText(match[0]).slice(0, 120);
      }
    }
  }

  return "";
}

function getArticleContextText(articleElement) {
  const heading = articleElement && articleElement.querySelector("h1");
  const contextRoot = heading
    ? heading.closest("article, main, [role='main'], [class*='article'], [class*='materia'], [class*='noticia']") || articleElement
    : articleElement;

  if (!contextRoot) {
    return "";
  }

  const clone = contextRoot.cloneNode(true);
  clone.querySelectorAll("script, style, noscript, svg, canvas, iframe, nav, header, footer, aside").forEach((element) => element.remove());

  return normalizeText(clone.textContent).slice(0, 2200);
}

function cleanAuthor(value) {
  return normalizeText(value)
    .replace(/^por\s+/i, "")
    .replace(/^publicado por\s+/i, "")
    .replace(/^autor(?:a)?\s*[:\-]\s*/i, "")
    .replace(/\s+(?:\d{1,2}\/\d{1,2}\/\d{2,4}).*$/i, "")
    .replace(/\s+Atualizado\s+.+$/i, "")
    .trim();
}

function cleanTitle(title) {
  return normalizeText(title)
    .replace(/\s+[|-]\s+[^|-]{2,80}$/g, "")
    .slice(0, 300);
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueTexts(texts) {
  const seen = new Set();
  const unique = [];

  texts.forEach((text) => {
    const key = text.toLowerCase();

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(text);
    }
  });

  return unique;
}

function cssEscape(value) {
  if (globalThis.CSS && CSS.escape) {
    return CSS.escape(value);
  }

  return String(value).replace(/"/g, "\\\"");
}
