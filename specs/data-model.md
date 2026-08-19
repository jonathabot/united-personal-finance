# Modelo de dados inicial

## User

- `id`
- `name`
- `email`
- `timezone`
- `currency`

## FinancialAccount

Representa conta corrente, dinheiro, vale ou reserva.

- `id`
- `userId`
- `name`
- `type`: `checking`, `cash`, `benefit`, `savings`, `emergency_reserve`
- `initialBalanceCents`
- `active`

## CreditCard

- `id`
- `userId`
- `name`
- `issuer`
- `closingDay`
- `dueDay`
- `creditLimitCents` opcional
- `active`

## Category

- `id`
- `userId` opcional para categorias padrão do sistema
- `name`
- `kind`: `income` ou `expense`
- `parentId` opcional

## Transaction

- `id`
- `userId`
- `type`: `expense`, `income`, `refund`, `transfer`
- `amountCents`
- `occurredAt`
- `description`
- `categoryId`
- `accountId` opcional
- `creditCardId` opcional
- `belongsToThirdParty`
- `status`: `pending`, `confirmed`, `voided`
- `source`: `chat`, `manual`, `import`
- `sourceText` opcional
- `createdAt`
- `updatedAt`

Uma transação deve apontar para uma conta ou cartão quando aplicável. Regras de
validação impedem combinações incompatíveis.

## InstallmentPlan

- `id`
- `transactionId`
- `totalAmountCents`
- `installmentCount`

## Installment

- `id`
- `planId`
- `number`
- `amountCents`
- `statementMonth`
- `status`: `scheduled`, `posted`, `anticipated`, `paid`

## Debt

- `id`
- `userId`
- `name`
- `principalCents`
- `knownBalanceCents`
- `installmentCents`
- `totalInstallments` opcional
- `paidInstallments`
- `status`

## AuditEvent

- `id`
- `userId`
- `entityType`
- `entityId`
- `action`
- `before` em JSON opcional
- `after` em JSON opcional
- `createdAt`

## ConversationContext

Mantém referências curtas para comandos como `corrige o último lançamento`.
Não substitui os dados financeiros persistidos.

- `id`
- `userId`
- `sessionId`
- `lastReferencedEntityType`
- `lastReferencedEntityId`
- `expiresAt`
