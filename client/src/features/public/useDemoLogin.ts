import { DEMO_PASSWORD, type Portal, type PublicUser } from "@kampus/shared";
import { useNavigate } from "react-router";
import { errorMessage } from "../../api/client.ts";
import { useLogin } from "../../api/hooks.ts";
import { homePathFor } from "../../components/layout/paths.ts";
import { useToast } from "../../components/ui/index.ts";

/** As contas partilhadas da demo (ver shared/src/demo.ts e o seed). */
export const DEMO_ACCOUNTS: Record<Portal, string> = {
  student: "student@example.com",
  staff: "staff@example.com",
};
export { DEMO_PASSWORD };

/**
 * Entra numa conta demo com um clique. Quem visita o portfólio dá poucos minutos ao
 * site: copiar email e password é atrito a mais antes de ver a visita.
 */
export function useDemoLogin() {
  const login = useLogin();
  const toast = useToast();
  const navigate = useNavigate();

  /** `target` decide para onde ir depois de entrar; por omissão, a casa do perfil. */
  const start = (portal: Portal, target: (user: PublicUser) => string = homePathFor) => {
    login.mutate(
      { email: DEMO_ACCOUNTS[portal], password: DEMO_PASSWORD, portal },
      {
        onSuccess: ({ user }) => {
          toast({ title: `Welcome, ${user.firstName}!` });
          navigate(target(user), { replace: true });
        },
        onError: (error) => {
          toast({ title: "Couldn't open the demo", description: errorMessage(error), tone: "error" });
          login.reset();
        },
      },
    );
  };

  return {
    start,
    pendingPortal: login.isPending ? login.variables?.portal : undefined,
    isPending: login.isPending,
    isIdle: login.isIdle,
  };
}
