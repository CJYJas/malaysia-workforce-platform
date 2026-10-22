import type { ComponentProps } from "react";

export function Link({ href, ...props }: ComponentProps<"a">) {
  return <a {...props} href={href} onClick={(event) => event.preventDefault()} />;
}
export function useLocation() {
  return ["/"] as const;
}
