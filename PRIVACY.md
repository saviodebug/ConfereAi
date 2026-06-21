# Politica de Privacidade do ConfereAi

O ConfereAi analisa sinais de risco em paginas, textos e imagens enviados pelo usuario para apoiar a checagem de informacoes politicas e eleitorais.

## Dados processados

A extensao pode processar:

- texto visivel da pagina atual quando o usuario solicita uma analise;
- texto digitado ou colado manualmente pelo usuario;
- texto extraido localmente de imagens ou prints enviados pelo usuario;
- URL, titulo e sinais de risco associados a uma analise;
- um identificador local da instalacao da extensao, usado para separar historico e estatisticas dessa instalacao.

## Como os dados sao usados

Os dados sao usados somente para executar a analise solicitada, exibir o resultado, sugerir fontes confiaveis e manter historico e estatisticas da instalacao da extensao.

A extensao nao afirma se uma noticia e verdadeira ou falsa. Ela classifica sinais de risco e recomenda verificacao em fontes confiaveis.

## Compartilhamento com servicos externos

As analises sao enviadas para a API do ConfereAi hospedada na Vercel. O backend pode usar Supabase para armazenar historico e estatisticas e pode usar a API Gemini para gerar analise complementar quando esse recurso estiver habilitado.

Chaves de API e credenciais de servico nao ficam na extensao.

## Dados que nao coletamos

O ConfereAi nao coleta senhas, dados de pagamento, mensagens privadas, credenciais de login ou arquivos pessoais que nao tenham sido enviados pelo usuario para analise.

## Controle do usuario

O usuario decide quando executar uma analise. O historico e vinculado a um identificador local da instalacao da extensao, nao a uma conta de login.

## Contato

Para duvidas sobre privacidade, abra uma issue no repositorio do projeto:

https://github.com/saviodebug/ConfereAi/issues
