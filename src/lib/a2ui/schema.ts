import { z } from "zod";

export const tableColumnSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  format: z.enum(["text", "currency", "date", "badge"]).default("text"),
});

const componentSchema = z.discriminatedUnion("component", [
  z.object({
    id: z.string(),
    component: z.literal("FinanceDataTable"),
    title: z.string(),
    columnsPath: z.string(),
    rowsPath: z.string(),
  }),
  z.object({
    id: z.string(),
    component: z.literal("FinanceKpi"),
    label: z.string(),
    valuePath: z.string(),
  }),
  z.object({
    id: z.string(),
    component: z.literal("TransactionConfirmation"),
    title: z.string(),
    transactionPath: z.string(),
  }),
  z.object({ id: z.string(), component: z.literal("FinancialHealthCard"), dataPath: z.string() }),
  z.object({ id: z.string(), component: z.literal("ProjectionChart"), dataPath: z.string() }),
  z.object({ id: z.string(), component: z.literal("CategoryBreakdown"), dataPath: z.string() }),
  z.object({ id: z.string(), component: z.literal("SavingsOpportunityTable"), dataPath: z.string() }),
  z.object({ id: z.string(), component: z.literal("ScenarioComparison"), dataPath: z.string() }),
  z.object({ id: z.string(), component: z.literal("ClarificationCard"), dataPath: z.string() }),
  z.object({ id: z.string(), component: z.literal("ErrorCard"), dataPath: z.string() }),
]);

export const a2uiMessageSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("createSurface"),
    version: z.literal("v0.9.1"),
    surfaceId: z.string(),
    catalogId: z.literal("https://united.finance/a2ui/catalog/v1.json"),
  }),
  z.object({
    kind: z.literal("updateComponents"),
    version: z.literal("v0.9.1"),
    surfaceId: z.string(),
    components: z.array(componentSchema),
  }),
  z.object({
    kind: z.literal("updateDataModel"),
    version: z.literal("v0.9.1"),
    surfaceId: z.string(),
    data: z.record(z.string(), z.unknown()),
  }),
]);

export const a2uiPayloadSchema = z.array(a2uiMessageSchema).min(3);

export type A2UIMessage = z.infer<typeof a2uiMessageSchema>;
export type A2UIPayload = z.infer<typeof a2uiPayloadSchema>;
export type A2UIComponent = z.infer<typeof componentSchema>;
export type TableColumn = z.infer<typeof tableColumnSchema>;
