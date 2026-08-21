import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AccountMenu } from "./account-menu";

describe("AccountMenu", () => {
  it("reveals the signed-in email and a logout action from the avatar", () => {
    const markup = renderToStaticMarkup(
      <AccountMenu initial="L" email="lebot@example.com" logoutAction="/logout" />,
    );

    expect(markup).toContain("<details");
    expect(markup).toContain("lebot@example.com");
    expect(markup).toContain(">Sair</button>");
  });
});
