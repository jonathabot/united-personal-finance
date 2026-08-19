# Especificação do MVP

## Objetivo

Permitir que uma pessoa registre e consulte suas finanças por meio de mensagens
em português, com uma visão mensal por cartão e resultados financeiros
reproduzíveis.

## Fluxo principal

1. O usuário envia uma mensagem, por exemplo: `gastei 20 reais no Itaú com almoço`.
2. A camada de interpretação propõe um comando estruturado.
3. O sistema valida campos, regras e ambiguidades.
4. O usuário confirma o lançamento quando necessário.
5. O lançamento é persistido.
6. O motor financeiro recalcula as visões afetadas.
7. A interface apresenta o resultado e permite editar ou desfazer a ação.

## Escopo da primeira versão

### Cadastro

- Contas e cartões.
- Data de fechamento e vencimento dos cartões.
- Categorias de receitas e despesas.
- Saldo inicial opcional.

### Lançamentos

- Despesa à vista ou no cartão.
- Receita.
- Compra parcelada.
- Estorno ou crédito.
- Despesa pertencente a terceiro.
- Edição e exclusão lógica de um lançamento.
- Histórico das alterações.

### Consultas

- Fatura atual por cartão.
- Parcelas futuras por cartão e mês.
- Total mensal de receitas e despesas.
- Gastos agrupados por categoria.
- Tabela consolidada dos próximos meses.

### Interface

- Chat em português.
- Prévia estruturada antes da confirmação quando houver ambiguidade.
- Dashboard mensal responsivo.
- Tela de histórico para corrigir lançamentos.

## Fora do MVP

- Integração bancária automática.
- Envio por WhatsApp.
- Leitura de comprovantes e faturas por imagem ou PDF.
- Recomendações de investimento.
- Compartilhamento de uma conta entre várias pessoas.

## Arquitetura proposta

- Aplicação web full-stack em Next.js e TypeScript.
- PostgreSQL como banco de dados.
- Camada de interpretação de linguagem natural com saída estruturada.
- Serviços determinísticos para faturas, parcelas, saldos e projeções.
- Testes unitários para todas as regras financeiras.

## Comando estruturado inicial

```json
{
  "intent": "create_transaction",
  "type": "expense",
  "amount": 20,
  "occurredAt": "2026-08-18",
  "accountOrCard": "Itaú",
  "category": "Alimentação",
  "description": "Almoço",
  "installments": 1,
  "belongsToThirdParty": false,
  "confidence": 0.96,
  "missingFields": []
}
```

O backend nunca deve persistir diretamente a resposta do modelo. Ela passa por
validação de esquema, resolução de entidades e regras de negócio.

## Decisões pendentes

- Se todo gasto exige confirmação ou apenas interpretações ambíguas.
- Como importar o estado financeiro existente no chat.
- Se o primeiro deploy usará Supabase ou PostgreSQL gerenciado diretamente.
- Quais colunas exatas compõem a tabela mensal usada atualmente.
