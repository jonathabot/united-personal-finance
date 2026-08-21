# ChatGPT Docs — diagnóstico e evolução do agente financeiro

## Objetivo deste documento

Este documento registra as principais dúvidas e percepções levantadas durante o desenvolvimento da POC do United Personal Finance. Ele explica por que o agente atual às vezes parece limitado, como a arquitetura funciona hoje e qual evolução pode aproximar o aplicativo da experiência da conversa original no ChatGPT.

O objetivo não é concluir que o modelo atual deve ser abandonado. A recomendação é terminar a POC com o modelo OSS, melhorar a arquitetura e somente depois comparar esse modelo com a API do Gemini usando os mesmos testes.

## A queixa principal

A principal queixa é que o agente parece muito *hard coded*. Ele funciona bem quando a mensagem do usuário se parece com um caso previsto no código, mas tem dificuldade com perguntas diferentes, complementos inesperados ou mudanças de contexto.

Alguns sintomas percebidos:

- uma palavra da mensagem faz o agente entrar no fluxo errado;
- depois de escolher um fluxo, ele insiste naquele caso mesmo quando a intenção era outra;
- perguntas mais abertas ou analíticas não recebem uma resposta tão contextual;
- mudanças de preferência, como uma nova maneira de calcular ou apresentar o saldo, não são compreendidas como regras persistentes;
- a experiência parece mais próxima de um formulário em formato de chat do que da conversa financeira original no ChatGPT.

Essa percepção é válida. O comportamento não é causado apenas pela capacidade do modelo OSS. Uma parte importante vem da maneira como o runtime foi organizado.

## As inseguranças levantadas

### “O modelo OSS é pouco inteligente?”

O modelo atual é menor que modelos comerciais de ponta, portanto pode realmente ter mais dificuldade com ambiguidades, contexto longo e instruções complexas. Porém, a arquitetura atual limita o espaço em que ele pode interpretar livremente a conversa.

Em várias situações, o código escolhe uma intenção antes de consultar o modelo. Por isso, trocar imediatamente para Gemini pode melhorar alguns casos, mas não elimina o problema estrutural.

### “Devo migrar agora para o Gemini gratuito?”

Não é necessário durante a construção da POC. Continuar com o OSS permite terminar e validar o motor financeiro, as tools, as confirmações, a persistência e a interface sem adicionar outra integração agora.

O Gemini gratuito pode ser uma boa alternativa para testes posteriores. A comparação deve acontecer quando o runtime estiver menos rígido. Caso contrário, o Gemini também ficará preso às mesmas decisões antecipadas do código.

Também é importante revisar limites e tratamento de dados do plano gratuito antes de enviar dados financeiros reais. Um tier gratuito é adequado para experimentação, mas não deve ser considerado automaticamente a configuração final de produção.

### “O aplicativo conseguirá conversar como a conversa original do ChatGPT?”

É possível chegar mais perto, mas isso não depende somente do modelo. A conversa original tinha:

- contexto acumulado;
- regras financeiras pessoais aprendidas ao longo do tempo;
- capacidade de preservar uma tabela e alterar somente o item solicitado;
- explicações sobre o motivo de cada mudança;
- separação entre despesas próprias e de terceiros;
- continuidade entre mensagens curtas;
- uma forma consistente de apresentar projeções e planos de quitação.

O aplicativo precisa representar essas características em dados, preferências, tools e memória. O modelo ajuda a interpretar e explicar, mas o motor financeiro continua responsável pelas contas.

## Como o aplicativo funciona hoje

A arquitetura atual segue um princípio correto:

> A IA interpreta; o código calcula.

As responsabilidades principais são:

1. O chat recebe a mensagem e o histórico.
2. O runtime tenta identificar a intenção.
3. Uma tool é selecionada.
4. A tool consulta ou altera dados por meio do domínio e dos repositórios.
5. O motor financeiro calcula valores em centavos.
6. O resultado é validado e apresentado como texto ou A2UI.
7. Operações que alteram dados usam rascunho e confirmação.

O projeto já possui uma base importante:

- cálculos determinísticos;
- tools tipadas;
- validação de argumentos;
- rascunhos confirmáveis;
- histórico auditável;
- Supabase com isolamento por usuário;
- componentes visuais validados;
- testes do motor financeiro e dos principais fluxos.

O problema está principalmente na camada de interpretação e orquestração, não no princípio do motor financeiro.

## O que significa “hard coded” neste caso

*Hard coded* significa que muitas decisões foram escritas diretamente como regras específicas no código.

Um exemplo simplificado:

```ts
if (mensagem contém "comparar") {
  usar compare_financial_months;
}

if (mensagem contém "economizar") {
  usar analyze_spending;
}

if (mensagem contém "mês que vem") {
  usar query_financial_overview;
}
```

Esse estilo é útil para construir rapidamente uma POC e garantir comportamentos críticos. O problema aparece quando a linguagem natural não segue exatamente as combinações previstas.

Por exemplo:

> “Eu gostei da comparação, mas daqui para frente quero que a reserva não entre no saldo disponível.”

A palavra “comparação” pode fazer o código selecionar a tool de comparação, embora a intenção real seja alterar uma preferência de cálculo.

## O que é regex

Regex é a abreviação de *regular expression*, ou expressão regular. É uma maneira de procurar padrões dentro de um texto.

Uma regex pode reconhecer:

- valores como `R$ 250,00`;
- datas como `2026-08`;
- percentuais como `20%`;
- palavras como “confirmo” ou “cancelar”;
- frases específicas como “mês que vem”.

Exemplo conceitual:

```ts
/confirmo|confirmar|confirma/i
```

Essa expressão verifica se o texto contém alguma dessas formas da palavra confirmar.

Regex não entende intenção ou significado. Ela apenas reconhece um formato ou uma sequência de caracteres. Por isso, é excelente para extrair um valor ou reconhecer uma confirmação inequívoca, mas é frágil como mecanismo principal de compreensão da conversa.

### Onde regex é apropriada

- extrair datas, valores e percentuais;
- reconhecer respostas inequívocas, como “confirmo”;
- validar formatos;
- aplicar proteções simples;
- oferecer uma recuperação segura quando argumentos do modelo forem inválidos.

### Onde regex não deveria decidir sozinha

- intenção de perguntas abertas;
- mudança de preferência;
- interpretação de contexto acumulado;
- identificação do que deve ser preservado de uma resposta anterior;
- decisão entre analisar, simular, comparar ou alterar uma regra quando a frase é ambígua.

## Regex-first e LLM-first

### Fluxo regex-first atual

De maneira simplificada, o fluxo atual é:

```text
mensagem
  → regex e inferência determinística de intenção
  → case específico
  → tool
  → resultado da tool
  → resposta
```

O modelo recebe principalmente os casos que não foram resolvidos antes. Isso faz com que uma inferência errada do código domine o restante do fluxo.

### Fluxo LLM-first recomendado

No fluxo recomendado:

```text
mensagem + histórico + preferências + estado relevante
  → modelo interpreta a intenção
  → modelo escolhe uma tool ou pede esclarecimento
  → código valida a operação e os argumentos
  → tool consulta ou calcula
  → resultado retorna ao modelo
  → modelo explica o resultado
```

“LLM-first” não significa deixar a IA controlar tudo. Significa deixá-la ser a primeira responsável pela interpretação da linguagem.

O código continua soberano sobre:

- cálculos;
- validação;
- permissões;
- persistência;
- confirmações;
- auditoria;
- invariantes financeiras;
- bloqueio de operações incompatíveis.

Essa separação pode ser resumida assim:

> O modelo entende o pedido; o domínio decide o que é válido; o motor calcula; o modelo explica.

## Por que o resultado da tool deve voltar ao modelo

Atualmente, em muitos fluxos, a tool produz um resultado que já é usado como resposta final. Isso é seguro para os números, mas reduz a capacidade conversacional.

No ciclo completo, o modelo recebe algo estruturado como:

```json
{
  "previousBalanceCents": 237765,
  "newBalanceCents": 231911,
  "differenceCents": -5854,
  "reason": "credit_card_total_changed"
}
```

O modelo não precisa refazer a subtração. Ele usa os números calculados para explicar que o saldo diminuiu e qual alteração provocou isso.

Esse segundo turno do modelo permite:

- explicar impacto;
- mencionar premissas;
- relacionar o resultado com a pergunta;
- preservar o tom da conversa;
- sugerir uma próxima análise sem inventar números.

## Regras pessoais e preferências configuráveis

Pedidos como o exemplo abaixo não deveriam modificar código automaticamente:

> “Gostei da tabela, mas quero que o cálculo do saldo seja desta outra maneira.”

O modelo deveria interpretar o pedido e preparar uma mudança de preferência:

1. identificar a regra solicitada;
2. explicar como ela afetará os resultados;
3. pedir informações ausentes;
4. gerar uma prévia;
5. solicitar confirmação;
6. persistir uma configuração suportada;
7. pedir ao motor financeiro que recalcule a projeção.

Exemplos de preferências configuráveis:

- incluir ou excluir a reserva do saldo disponível;
- considerar a fatura no mês de competência ou pagamento;
- separar despesas de terceiros;
- não considerar benefícios como dinheiro disponível;
- escolher a estratégia de quitação;
- definir o formato preferido da tabela.

Algumas regras não devem ser alteráveis por conversa, como:

- dinheiro armazenado em centavos;
- transferências não serem contadas como receita e despesa simultaneamente;
- parcelas não serem duplicadas;
- histórico financeiro não ser apagado silenciosamente;
- nenhuma mudança ser persistida sem validação e, quando necessário, confirmação.

## Arquitetura recomendada

Uma evolução segura pode separar o runtime em responsabilidades menores:

```text
Chat
  ↓
Context Builder
  - histórico recente
  - resumo financeiro
  - preferências confirmadas
  - rascunho pendente
  ↓
LLM Orchestrator
  - responde diretamente
  - pede esclarecimento
  - escolhe uma ou mais tools
  ↓
Policy e Validation Layer
  - verifica permissão
  - valida argumentos
  - protege invariantes
  ↓
Tools e Motor Financeiro
  - consulta
  - calcula
  - simula
  - prepara rascunhos
  ↓
LLM Response Synthesis
  - explica dados calculados
  - informa premissas
  - preserva o contexto
  ↓
A2UI
```

Componentes conceituais recomendados:

- **Context Builder:** seleciona somente o contexto necessário para cada turno.
- **LLM Orchestrator:** interpreta a mensagem e coordena tools.
- **Policy Layer:** impede ações não autorizadas ou incompatíveis.
- **Tool Executor:** executa tools e devolve resultados estruturados.
- **Preference Service:** mantém regras pessoais confirmadas.
- **Response Synthesizer:** transforma resultados confiáveis em explicações naturais.
- **Evaluation Suite:** mede a qualidade do agente com conversas representativas.

Essa arquitetura não precisa ser implementada de uma vez. Ela pode substituir o runtime atual gradualmente.

## Como avaliar o modelo OSS e o Gemini

Uma avaliação justa deve usar exatamente as mesmas entradas e o mesmo estado financeiro.

Para cada cenário, registrar:

- intenção esperada;
- tool esperada, ou ausência de tool;
- argumentos esperados;
- necessidade de esclarecimento;
- contexto que precisa ser preservado;
- fatos que a resposta deve mencionar;
- fatos que a resposta não pode inventar;
- latência;
- consumo e custo, quando aplicável.

Exemplos de avaliação:

1. “Atualize somente o cartão informado e preserve os demais valores.”
2. “Mostre a tabela completa mês a mês.”
3. “Essa parte da fatura pertence a outra pessoa.”
4. “Por que minha sobra diminuiu?”
5. “Se eu assumir uma nova mensalidade, ainda consigo quitar as dívidas?”
6. “Gostei da tabela, mas quero que a reserva apareça separada.”
7. Após o agente perguntar a data, responder apenas “dia 18”.
8. Corrigir uma informação mencionada vários turnos antes.

Primeiro, esses cenários devem ser executados no OSS com o runtime melhorado. Depois, a mesma suíte pode ser executada no Gemini. A migração passa a ser uma decisão baseada em evidência, e não somente em sensação.

## Próximos passos: etapas 7 a 14

### Passo 7 — concluir o aceite das conversas analíticas

O código da etapa 7 existe, mas o roteiro de aceite ainda precisa ser executado.

Objetivos:

- testar projeções, comparações, economias e simulações com dados reais de desenvolvimento;
- confirmar que nenhuma conta depende do modelo;
- registrar perguntas que entram na intenção errada;
- registrar respostas que perdem contexto;
- criar uma baseline antes da refatoração.

Concluído quando os cenários forem executados e os erros estiverem documentados.

### Passo 8 — criar a avaliação conversacional

Transformar aproximadamente 30 a 50 perguntas representativas em uma suíte de avaliação.

As melhores fontes são:

- a conversa financeira original do ChatGPT;
- perguntas que falharam durante o uso da POC;
- respostas curtas de continuidade;
- pedidos de alteração parcial;
- perguntas inesperadas, mas válidas dentro do domínio.

Concluído quando cada cenário possuir entrada, contexto e resultado esperado.

### Passo 9 — refatorar para um runtime LLM-first

O modelo passa a interpretar a intenção antes dos cases determinísticos, exceto em comandos realmente inequívocos e proteções de segurança.

Objetivos:

- reduzir os `if` de intenção antecipada;
- manter regex para extração e validação;
- permitir resposta direta, pedido de esclarecimento ou tool;
- impedir que uma palavra isolada force um fluxo incorreto;
- conservar os fallbacks seguros.

Concluído quando perguntas variadas puderem escolher a tool correta sem depender de frases exatas.

### Passo 10 — implementar o ciclo completo de tools

Depois de executar uma tool, enviar seu resultado estruturado novamente ao modelo para produzir a resposta final.

Objetivos:

- manter todos os números originados no motor;
- permitir explicações mais naturais;
- informar premissas e impactos;
- suportar mais de uma etapa quando realmente necessária;
- evitar loops ilimitados de tools.

Concluído quando o modelo conseguir explicar resultados sem recalculá-los ou inventá-los.

### Passo 11 — adicionar preferências financeiras confirmáveis

Criar suporte a regras pessoais que o motor conheça e consiga aplicar.

Objetivos:

- distinguir preferências de invariantes do sistema;
- preparar mudanças como rascunhos;
- mostrar o impacto antes de salvar;
- exigir confirmação quando a mudança afetar projeções futuras;
- persistir a preferência por usuário.

Concluído quando o usuário puder alterar uma regra suportada por linguagem natural e receber uma projeção recalculada.

### Passo 12 — melhorar memória e continuidade

Separar histórico bruto de memória estruturada.

Contextos relevantes:

- mensagens recentes;
- resumo financeiro atualizado;
- preferências confirmadas;
- entidades mencionadas recentemente;
- rascunho ou esclarecimento pendente;
- decisões importantes da conversa.

Concluído quando respostas curtas e correções contextuais funcionarem sem enviar indefinidamente toda a conversa ao modelo.

### Passo 13 — comparar OSS e Gemini

Executar a mesma suíte de avaliação nos dois providers.

Comparar:

- precisão na seleção de tools;
- qualidade dos argumentos;
- uso do contexto;
- qualidade dos esclarecimentos;
- naturalidade da explicação;
- alucinações;
- latência;
- limites e custo;
- tratamento dos dados financeiros.

Concluído quando houver dados suficientes para decidir entre manter OSS, migrar para Gemini ou oferecer mais de um provider.

### Passo 14 — deploy e PWA

Esta etapa permanece em espera.

Antes do deploy, o agente deve possuir uma qualidade conversacional mínima, limites de segurança, tratamento de indisponibilidade, observabilidade e uma decisão consciente sobre provider e tratamento de dados.

Concluído quando o aplicativo estiver pronto para funcionar fora do ambiente local com segurança e previsibilidade.

## Ordem prática recomendada

```text
aceite do passo 7
  → registrar falhas reais
  → criar suíte de avaliação
  → refatorar o roteamento para LLM-first
  → devolver resultados das tools ao modelo
  → criar preferências financeiras
  → estruturar memória
  → comparar OSS e Gemini
  → decidir sobre deploy
```

## Glossário

### Agente

Parte do sistema que interpreta a conversa, escolhe ações e organiza a resposta.

### LLM

Modelo de linguagem capaz de interpretar e gerar texto. OSS e Gemini são opções de modelos usados pelo agente.

### OSS

Neste projeto, refere-se ao modelo aberto atualmente acessado pela Groq. Ele é o modelo utilizado durante a POC.

### Provider

Serviço que fornece acesso ao modelo, como Groq, OpenAI ou Google Gemini.

### Runtime

Código que coordena mensagens, histórico, modelo, tools, validação e resposta.

### Tool

Função oferecida ao modelo para executar uma operação permitida, como consultar um resumo, simular um cenário ou preparar um lançamento.

### Regex

Expressão usada para reconhecer padrões de texto. É adequada para formatos e comandos inequívocos, mas não compreende significado completo.

### Regex-first

Arquitetura em que regras textuais tentam decidir a intenção antes do modelo.

### LLM-first

Arquitetura em que o modelo interpreta primeiro a linguagem, enquanto o código valida e executa somente operações seguras.

### Determinístico

Comportamento que produz o mesmo resultado para a mesma entrada. Cálculos financeiros e validações devem ser determinísticos.

### Invariante

Regra fundamental que nunca deve ser quebrada, independentemente de preferências do usuário.

### Rascunho confirmável

Mudança preparada e exibida ao usuário antes de ser persistida.

### A2UI

Payload estruturado e validado que descreve cards, tabelas e gráficos renderizados pelo aplicativo.

### Suíte de avaliação

Conjunto reproduzível de conversas usadas para medir a qualidade de diferentes versões do agente ou modelos.

## Decisões recomendadas

1. Continuar com o OSS até concluir e amadurecer a POC.
2. Não atribuir todos os problemas atuais ao modelo.
3. Executar o aceite do passo 7 antes de refatorar.
4. Transformar a conversa original e as falhas reais em avaliações reproduzíveis.
5. Migrar gradualmente de regex-first para LLM-first.
6. Manter cálculos, validação, segurança e persistência fora do modelo.
7. Implementar o retorno do resultado das tools ao modelo.
8. Representar regras pessoais como preferências suportadas e confirmáveis.
9. Comparar OSS e Gemini somente depois de melhorar o runtime.
10. Manter deploy e PWA em espera até existir qualidade conversacional mínima.

## Conclusão

O projeto não está seguindo uma direção errada. A arquitetura de domínio é sólida para uma POC financeira: o código calcula, as mudanças são validadas e existe preocupação com confirmação e auditoria.

A limitação atual está na camada que transforma linguagem natural em decisões. Muitas regras determinísticas ajudaram a construir os primeiros fluxos, mas agora começam a impedir conversas mais flexíveis.

A próxima evolução não é entregar os cálculos ao modelo. É melhorar a divisão de responsabilidades: deixar o modelo compreender a conversa, deixar o domínio proteger as regras, deixar o motor calcular e permitir que o modelo explique resultados confiáveis.

Depois dessa evolução, a comparação entre OSS e Gemini será muito mais justa e útil.
