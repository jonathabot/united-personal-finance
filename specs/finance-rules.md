# Regras financeiras

## Princípios

1. A IA interpreta intenções; o código calcula valores.
2. Todo valor monetário é armazenado em centavos, nunca em ponto flutuante.
3. Todo lançamento mantém sua origem e seu histórico de alterações.
4. Operações ambíguas não alteram os dados silenciosamente.

## Regras importadas da conversa atual

- Despesas de terceiros não contam como despesas do usuário.
- Valores negativos representam redução da fatura, como estorno ou crédito.
- O mês da tabela representa o mês em que a dívida foi gerada, ainda que a
  fatura seja paga no mês seguinte.
- `QUITA` representa empréstimos.
- `ANTECIPA` representa parcelas futuras de cartões.
- Uma quitação não pode ser estimada abaixo do saldo nominal conhecido.
- Desconto por antecipação é tratado como bônus e não como valor garantido.
- Reserva de emergência não integra o orçamento mensal disponível.
- Vale-refeição não é considerado dinheiro disponível.

## Datas de cartão

- A data da compra determina a qual fatura ela pertence, usando a data de
  fechamento configurada para o cartão.
- O vencimento indica quando a fatura deve ser paga, mas não altera o mês em que
  a dívida foi gerada na visão histórica.
- Mudanças futuras na data de fechamento não devem reclassificar faturas já
  fechadas.

## Parcelamento

- A soma das parcelas deve ser exatamente igual ao valor total da compra.
- Diferenças de arredondamento em centavos ficam na última parcela.
- Cada parcela registra seu número, total de parcelas e competência.
- Antecipar parcelas cria uma operação explícita; não apaga o histórico original.

## Correções

- Editar um lançamento gera uma nova versão de auditoria.
- Excluir é uma exclusão lógica e reversível.
- Frases como `na verdade foram 25` só podem alterar um lançamento quando o
  contexto identifica exatamente um candidato; caso contrário, o sistema pede
  que o usuário escolha.
