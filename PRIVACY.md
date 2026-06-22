# Política de Privacidade do ConfereAí

O ConfereAí analisa sinais de risco em páginas e imagens enviadas pelo usuário para apoiar a checagem de informações políticas, eleitorais e cívicas.

## Dados processados

A extensão pode processar:

- texto visível da página atual quando o usuário solicita uma análise;
- metadados da notícia capturados na página, como título, URL, autor e data quando disponíveis;
- texto extraído localmente de imagens ou prints enviados pelo usuário;
- sinais de risco, critérios, palavras-chave e classificação associados a uma análise;
- um identificador local da instalação da extensão, usado para separar histórico e estatísticas dessa instalação.

## Como os dados são usados

Os dados são usados somente para executar a análise solicitada, exibir o resultado, sugerir fontes confiáveis e manter histórico e estatísticas da instalação da extensão.

A extensão não afirma se uma notícia é verdadeira ou falsa. Ela classifica sinais de risco e recomenda verificação em fontes confiáveis.

## Compartilhamento com serviços externos

As análises são enviadas para a API do ConfereAí hospedada na Vercel. O backend pode usar Supabase para armazenar histórico e estatísticas e pode usar a API Gemini para gerar análise complementar quando esse recurso estiver habilitado.

Chaves de API e credenciais de serviço não ficam na extensão.

## Dados que não coletamos

O ConfereAí não coleta senhas, dados de pagamento, mensagens privadas, credenciais de login ou arquivos pessoais que não tenham sido enviados pelo usuário para análise.

## Controle do usuário

O usuário decide quando executar uma análise. O histórico é vinculado a um identificador local da instalação da extensão, não a uma conta de login.

## Contato

Para dúvidas sobre privacidade, abra uma issue no repositório do projeto:

https://github.com/saviodebug/ConfereAi/issues
