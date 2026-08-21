import type { ComponentProps } from "react";

type AccountMenuProps = {
  initial: string;
  email: string;
  logoutAction: NonNullable<ComponentProps<"form">["action"]>;
};

export function AccountMenu({ initial, email, logoutAction }: AccountMenuProps) {
  return <details className="accountMenu">
    <summary className="railAvatar" aria-label="Abrir menu da conta">{initial}</summary>
    <div className="accountPopover">
      <span className="accountLabel">Conta</span>
      <strong title={email}>{email}</strong>
      <form action={logoutAction}>
        <button type="submit" className="logoutButton">Sair</button>
      </form>
    </div>
  </details>;
}
