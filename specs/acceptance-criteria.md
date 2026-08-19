# Critérios de aceite do MVP

## Registro simples

Dado que existe um cartão chamado Itaú, quando o usuário disser `gastei 20 reais
no Itaú com almoço`, o sistema deve propor uma despesa de R$ 20,00 no cartão
Itaú, na categoria Alimentação e na data local atual.

Após a confirmação, o total da fatura correspondente deve aumentar exatamente
R$ 20,00.

## Ambiguidade

Se existirem dois meios de pagamento que possam ser chamados de Itaú, o sistema
não deve escolher silenciosamente. Deve apresentar as opções ao usuário.

Se a mensagem não trouxer uma categoria, o sistema pode sugerir uma, mas deve
preservar a possibilidade de correção.

## Correção contextual

Após criar um lançamento de R$ 20,00, quando o usuário disser `na verdade foram
25 reais`, o sistema deve apresentar a alteração do lançamento anterior para
R$ 25,00. O total deve aumentar somente pela diferença de R$ 5,00.

## Terceiros

Um lançamento marcado como pertencente a terceiro deve aparecer no detalhamento
da fatura, mas não no total de despesas pessoais do usuário.

## Estorno

Um estorno de R$ 30,00 deve reduzir a fatura em exatamente R$ 30,00 sem ser
contabilizado como nova receita pessoal.

## Parcelas

Uma compra de R$ 100,00 em três vezes deve gerar parcelas de R$ 33,33, R$ 33,33
e R$ 33,34, cuja soma seja exatamente R$ 100,00.

## Segurança dos cálculos

- Nenhum total financeiro pode depender de aritmética produzida pelo modelo de IA.
- Reprocessar os mesmos lançamentos deve produzir os mesmos totais.
- Toda edição ou exclusão deve ser auditável e reversível.

## Tabela mensal

A tabela mensal deve exibir, no mínimo:

- cartão;
- total da fatura;
- parcelas futuras;
- data de vencimento;
- total consolidado.

Os valores da tabela devem ser derivados dos lançamentos persistidos, e não de
texto mantido no histórico da conversa.
