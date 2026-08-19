import { CategoryBreakdown } from "./category-breakdown";
import { ClarificationCard, ErrorCard } from "./feedback-card";
import { FinancialHealthCard } from "./financial-health-card";
import { ProjectionChart } from "./projection-chart";
import { SavingsOpportunityTable } from "./savings-opportunity-table";
import { ScenarioComparison } from "./scenario-comparison";

export const a2uiCatalog = {
  FinancialHealthCard,
  ProjectionChart,
  CategoryBreakdown,
  SavingsOpportunityTable,
  ScenarioComparison,
  ClarificationCard,
  ErrorCard,
} as const;
