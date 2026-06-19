const { app, ensureInitialized } = require("./app");
const { getGeminiMode } = require("./analysisService");
const { isGeminiEnabled } = require("./geminiService");

const port = Number(process.env.PORT || 3000);

ensureInitialized()
  .then(() => {
    app.listen(port, () => {
      console.log(`VerificaVoto AI Gemini rodando em http://localhost:${port}`);
      console.log(`Modo atual: ${getGeminiMode()}`);
      console.log(`Banco atual: ${process.env.SUPABASE_URL ? "Supabase" : "SQLite local"}`);

      if (!isGeminiEnabled()) {
        console.log("Gemini não configurado. O backend continuará usando apenas regras locais.");
      }
    });
  })
  .catch((error) => {
    console.error("Erro ao inicializar backend:", error);
    process.exit(1);
  });
