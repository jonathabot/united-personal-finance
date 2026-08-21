import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CategoryBreakdown, type CategoryVisualData } from "./category-breakdown";

describe("CategoryBreakdown", () => {
  it("shows the net category total after refunds", () => {
    const data: CategoryVisualData[] = [
      { category: "Alimentação", currentCents: -2000, averageCents: 0, potentialSavingsCents: 0, trend: "down" },
      { category: "Casa", currentCents: 33000, averageCents: 0, potentialSavingsCents: 0, trend: "up" },
      { category: "Eletrônicos", currentCents: 60000, averageCents: 0, potentialSavingsCents: 0, trend: "up" },
    ];

    const markup = renderToStaticMarkup(<CategoryBreakdown data={data} />);

    expect(markup).toContain("Gasto líquido no mês");
    expect(markup).toContain("R$\u00a0910,00");
  });
});
