# Sentinel Learn

Claro. Eu faria o prompt já pensando em MVP funcional, sem misturar com QD4 e sem colocar funcionalidades desnecessárias agora.

SENTINELA — SISTEMA DE AVALIAÇÃO DE EXPLICAÇÕES POR ÁUDIO

Crie uma aplicação web chamada SENTINELA, uma ferramenta de aprendizagem ativa baseada no método de explicar um conteúdo com as próprias palavras.

1. OBJETIVO

O objetivo do Sentinela é permitir que o estudante:

Faça upload de um PDF de estudo.

O sistema leia e processe o conteúdo.

Identifique os principais assuntos e conceitos do material.

O estudante escolha um assunto para explicar.

O estudante grave um áudio explicando o assunto com suas próprias palavras.

O sistema transcreva o áudio.

A IA analise a explicação comparando-a com o conteúdo do PDF.

O Sentinela apresente uma avaliação detalhada sobre o nível de compreensão do estudante.

O sistema NÃO deve avaliar apenas a presença de palavras-chave. A análise deve ser semântica e conceitual.

O objetivo é responder:

“O estudante realmente entendeu o assunto ou apenas repetiu informações?”



2. IDENTIDADE DA INTERFACE

Nome do sistema:

SENTINELA

Subtítulo:

Explique. Entenda. Domine.

Interface moderna, limpa e profissional, voltada para estudantes e preparação para concursos.

Priorizar:

excelente experiência em celular;

interface responsiva;

navegação simples;

poucos elementos por tela;

feedback visual claro;

cards para apresentar resultados;

indicadores de progresso;

cores diferentes para acertos, erros e pontos de atenção.

Não criar uma interface excessivamente carregada.



3. FLUXO PRINCIPAL

O fluxo principal deve ser:

PDF → ASSUNTO → EXPLICAÇÃO → TRANSCRIÇÃO → ANÁLISE → RESULTADO

Criar uma experiência guiada, mostrando ao estudante em qual etapa ele está.

Exemplo de barra de progresso:

1. Material → 2. Assunto → 3. Explicação → 4. Análise → 5. Resultado



4. TELA INICIAL

Criar dashboard com:

SENTINELA

Explique o que você estudou e descubra se realmente aprendeu.

Botão principal:

+ NOVO ESTUDO

Também apresentar histórico das últimas avaliações.

Cada avaliação deve mostrar:

assunto;

data;

nota de domínio;

nível;

status.

Exemplo:

Memória RAM
Domínio: 82/100
Nível: Bom



5. UPLOAD DO PDF

Criar tela:

📄 ADICIONE SEU MATERIAL

Área para arrastar ou selecionar um PDF.

Aceitar arquivos PDF.

Depois do upload:

mostrar nome do arquivo;

tamanho;

quantidade de páginas, quando disponível;

indicador de processamento.

Mensagem durante processamento:

“O Sentinela está analisando seu material…”

A IA deve extrair:

assuntos;

conceitos;

definições;

relações entre conceitos;

informações importantes;

exemplos;

possíveis pontos de confusão.

Não mostrar necessariamente todo o conteúdo extraído ao estudante.



6. IDENTIFICAÇÃO DOS ASSUNTOS

Depois do processamento, apresentar:

🎯 O QUE VOCÊ VAI EXPLICAR?

Mostrar cards com os principais assuntos identificados no PDF.

Exemplo:

Hardware

Software

Memória RAM

Memória ROM

CPU

SSD x HD

Cada assunto deve ser selecionável.

Também criar opção:

🎲 DESAFIO SURPRESA

Quando selecionada, o Sentinela escolhe aleatoriamente um assunto relevante do material.



7. PREPARAÇÃO DA EXPLICAÇÃO

Depois de escolher o assunto, criar uma tela com uma pergunta/orientação gerada pela IA.

Exemplo:

EXPLIQUE:

“O que é memória RAM, qual sua função e o que acontece com os dados armazenados nela quando o computador é desligado?”

Orientação:

Explique com suas próprias palavras. Não leia o material. Imagine que você está ensinando esse assunto para outra pessoa.

Criar botão:

🎙️ COMEÇAR EXPLICAÇÃO



8. GRAVAÇÃO DO ÁUDIO

Criar gravador de áudio funcional.

Recursos:

iniciar gravação;

pausar;

continuar;

finalizar;

cancelar;

ouvir gravação;

refazer;

enviar para análise.

Mostrar cronômetro durante a gravação.

Não limitar obrigatoriamente o estudante a 1, 2 ou 3 minutos.

Caso seja necessário estabelecer limite técnico, deixar esse limite configurável.

Após finalizar:

OUVIR EXPLICAÇÃO

REFAZER

ANALISAR COM O SENTINELA



9. TRANSCRIÇÃO

Após o envio do áudio:

🎙️ Áudio recebido

O sistema deve converter o áudio em texto utilizando serviço de speech-to-text disponível na infraestrutura.

Mostrar:

SUA EXPLICAÇÃO

[transcrição completa]

A transcrição será utilizada pela IA para realizar a avaliação.

Se houver falhas significativas de transcrição, informar ao usuário e evitar gerar uma avaliação incorreta.



10. MOTOR DE AVALIAÇÃO DA IA

Criar uma etapa de análise utilizando IA.

A IA deve receber:

conteúdo relevante do PDF;

assunto escolhido;

pergunta/orientação apresentada ao estudante;

transcrição da explicação.

A IA deve avaliar a explicação semanticamente.

NÃO avaliar somente por correspondência de palavras.

A análise deve identificar:

🟢 ACERTOS

Conceitos explicados corretamente.

🔴 ERROS CONCEITUAIS

Informações tecnicamente incorretas.

🟡 LACUNAS

Informações importantes que deveriam ter sido explicadas, mas não foram.

🔵 RELAÇÕES ENTRE CONCEITOS

Verificar se o estudante conseguiu relacionar corretamente conceitos diferentes.

🧠 PROFUNDIDADE

Avaliar se a explicação demonstra:

memorização superficial;

compreensão básica;

compreensão intermediária;

domínio avançado.



11. SISTEMA DE NOTA

Criar nota geral de 0 a 100.

A nota deve considerar, pelo menos:

precisão conceitual;

conceitos fundamentais;

completude;

coerência;

relação entre conceitos;

profundidade da explicação.

Criar pesos configuráveis no backend.

Exemplo:

Precisão conceitual: 30%

Conceitos fundamentais: 25%

Completude: 20%

Relação entre conceitos: 15%

Profundidade: 10%

A nota final deve ser calculada pela IA, mas obedecer aos critérios definidos pelo sistema.



12. RESULTADO

Criar uma tela de resultado visualmente forte.

Exemplo:

🧠 RESULTADO DO SENTINELA

82/100

BOM DOMÍNIO

Texto:

“Você demonstrou boa compreensão do assunto, mas ainda existem alguns pontos que precisam ser revisados.”

Apresentar os critérios:

Precisão conceitual — 90/100

Conceitos fundamentais — 85/100

Completude — 72/100

Relação entre conceitos — 80/100

Profundidade — 78/100



13. ACERTOS

Criar card:

🟢 VOCÊ ACERTOU

Listar os principais pontos corretamente explicados pelo estudante.

Exemplo:

Explicou corretamente a função da memória RAM.

Identificou sua utilização durante a execução dos programas.

Diferenciou RAM de armazenamento permanente.



14. ERROS

Criar card:

🔴 ATENÇÃO A ESTES ERROS

Para cada erro:

O que você disse:

[trecho da explicação]

Problema:

[explicação do erro]

Correção:

[explicação correta baseada no PDF]

A IA não deve inventar correções que não estejam fundamentadas no material fornecido ou em conhecimento confiável definido pelo sistema.



15. LACUNAS

Criar card:

🟡 O QUE FALTOU NA SUA EXPLICAÇÃO

Mostrar os conceitos importantes identificados no PDF que não foram abordados ou foram abordados de maneira insuficiente.

Exemplo:

Volatilidade da memória RAM.

Diferença entre memória e armazenamento.

Relação entre RAM e programas em execução.



16. DIAGNÓSTICO FINAL

Criar uma área:

🎯 DIAGNÓSTICO DO SENTINELA

A IA deve produzir uma conclusão curta e objetiva.

Exemplo:

“Você compreende a função da memória RAM, mas ainda confunde memória principal com armazenamento permanente. Recomendo revisar esse ponto e realizar uma nova explicação.”



17. NOVA TENTATIVA

Após o resultado, disponibilizar:

🔄 EXPLICAR NOVAMENTE

Ao clicar, o estudante deverá gravar uma nova explicação.

Salvar as duas tentativas.

Exemplo:

Tentativa 1 — 58/100

Tentativa 2 — 84/100

Mostrar evolução.

📈 SUA EVOLUÇÃO

+26 pontos

E a IA deve identificar quais erros foram corrigidos.

Exemplo:

“Na segunda tentativa você corrigiu 3 dos 4 problemas identificados anteriormente.”



18. PERGUNTA DE APROFUNDAMENTO

Depois de uma primeira explicação, o Sentinela poderá gerar uma pergunta complementar.

Exemplo:

“Você afirmou que a RAM armazena informações temporariamente. O que acontece com essas informações quando o computador é desligado?”

O estudante poderá responder novamente por áudio.

A IA deverá analisar a resposta considerando o contexto da primeira explicação.



19. HISTÓRICO

Criar uma área:

📊 MEU HISTÓRICO

Registrar todas as explicações.

Filtros:

assunto;

material;

data;

nota;

nível.

Mostrar evolução do estudante.

Exemplo:

Hardware — 82

Software — 91

Redes — 64

Segurança — 73



20. BANCO DE DADOS

Estruturar o banco de dados para armazenar:

users

id

nome

email

created_at

study_materials

id

user_id

nome

arquivo

quantidade_paginas

texto_extraido

created_at

topics

id

material_id

nome

descrição

conceitos_principais

explanations

id

user_id

material_id

topic_id

pergunta

audio_url

transcription

score

level

created_at

evaluations

id

explanation_id

conceptual_accuracy

fundamental_concepts

completeness

conceptual_relationship

depth

diagnosis

evaluation_items

id

evaluation_id

type

title

description

source_reference

severity

Os tipos podem ser:

correct

error

missing

improvement



21. SEGURANÇA E PRIVACIDADE

Cada usuário deve ter acesso somente aos próprios:

PDFs;

áudios;

transcrições;

avaliações;

histórico.

Implementar autenticação e autorização adequadas.

Os arquivos devem ser armazenados de maneira segura.

Não permitir que um usuário consiga acessar diretamente arquivos ou avaliações de outro usuário.



22. TRATAMENTO DE ERROS

Criar estados para:

PDF inválido;

PDF sem texto;

falha no processamento;

áudio sem conteúdo;

falha na transcrição;

falha na análise da IA;

conexão interrompida;

arquivo muito grande;

microfone não autorizado.

Sempre apresentar mensagens simples e orientar o usuário sobre o próximo passo.



23. REGRA FUNDAMENTAL DA IA

O Sentinela deve seguir uma regra central:

NÃO CONFUNDIR REPETIÇÃO COM COMPREENSÃO.

O estudante pode utilizar palavras diferentes das utilizadas no PDF e ainda assim estar correto.

A IA deve reconhecer paráfrases, sinônimos e diferentes formas de explicar o mesmo conceito.

Da mesma forma, o estudante pode utilizar palavras presentes no PDF e ainda estar errado.

Portanto:

palavra-chave ≠ domínio

A avaliação deve priorizar:

significado + precisão + contexto + relação entre conceitos.



24. REFERÊNCIA AO MATERIAL

Sempre que possível, o Sentinela deve fundamentar sua avaliação no PDF enviado pelo estudante.

Quando identificar um erro ou uma lacuna, registrar a referência do conteúdo utilizado para chegar à conclusão.

Exemplo:

Fonte da análise: página 7 do material.

Isso permitirá maior transparência e confiança na avaliação.



25. MVP

Nesta primeira versão, priorizar somente o fluxo principal:

UPLOAD DO PDF

↓

PROCESSAMENTO DO MATERIAL

↓

IDENTIFICAÇÃO DOS ASSUNTOS

↓

ESCOLHA DO ASSUNTO

↓

PERGUNTA DA IA

↓

GRAVAÇÃO DO ÁUDIO

↓

TRANSCRIÇÃO

↓

ANÁLISE SEMÂNTICA

↓

NOTA

↓

ACERTOS + ERROS + LACUNAS

↓

DIAGNÓSTICO

↓

NOVA TENTATIVA

Não adicionar funcionalidades secundárias antes de garantir que esse fluxo esteja funcionando corretamente.



26. CRITÉRIO DE SUCESSO

O projeto será considerado funcional quando um usuário conseguir:

Entrar no sistema.

Enviar um PDF.

O Sentinela identificar os assuntos.

Escolher um assunto.

Receber uma pergunta.

Gravar uma explicação por áudio.

Ter o áudio transcrito.

Ter sua explicação analisada pela IA.

Receber uma nota de 0 a 100.

Visualizar acertos, erros e lacunas.

Receber um diagnóstico.

Refazer a explicação.

Comparar a evolução entre as tentativas.

Construa primeiro esse fluxo completo e funcional antes de adicionar recursos extras.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://explain-and-understand.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c08aec18-16e9-4f42-9749-9c96f2698ada).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
