const { getKeywordTerms } = require("./database");

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

async function extractKeywords({ titulo, texto }) {
  const terms = await getKeywordTerms();
  const normalizedContent = normalize(`${titulo || ""}\n${texto || ""}`);
  const found = new Set();

  for (const term of terms) {
    if (normalizedContent.includes(normalize(term))) {
      found.add(term);
    }
  }

  return Array.from(found);
}

module.exports = {
  extractKeywords
};
