import { useNavigate } from "@solidjs/router";
import { createEffect, type JSX, Show } from "solid-js";
import { authStore } from "~/lib/persist-store";

type RouteProtectionProps = {
  children: JSX.Element;
  redirectTo?: string;
  requireAuth?: boolean;
};

export function RouteProtection(props: RouteProtectionProps) {
  const navigate = useNavigate();
  const { store: auth } = authStore();

  createEffect(() => {
    if (props.requireAuth && !auth.isUserLoggedIn) {
      navigate(props.redirectTo || "/auth/onboarding");
    } else if (!props.requireAuth && auth.isUserLoggedIn) {
      navigate(props.redirectTo || "/");
    }
  });

  return (
    <Show
      when={
        (props.requireAuth && auth.isUserLoggedIn) ||
        !(props.requireAuth || auth.isUserLoggedIn)
      }
    >
      {props.children}
    </Show>
  );
}
