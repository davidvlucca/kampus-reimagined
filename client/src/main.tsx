import "@fontsource-variable/inter/wght.css";
import "@fontsource/poppins/latin-500.css";
import "@fontsource/poppins/latin-600.css";
import "@fontsource/poppins/latin-700.css";
import "@fontsource/vt323/latin-400.css";
import "./styles/index.css";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { ApiRequestError, isTimeout } from "./api/client.ts";
import { keys } from "./api/hooks.ts";
import { ToastProvider } from "./components/ui/index.ts";
import { router } from "./router.tsx";

// Sessão expirada a meio (401 num pedido qualquer): a sessão em cache passa a null e o
// RequireAuth leva ao login certo, com "Please log in to continue".
const onSessionLost = (error: unknown) => {
  if (error instanceof ApiRequestError && error.status === 401 && queryClient.getQueryData(keys.me)) {
    queryClient.setQueryData(keys.me, null);
  }
};

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onSessionLost }),
  mutationCache: new MutationCache({ onError: onSessionLost }),
  defaultOptions: {
    queries: {
      // Não insiste em erros 4xx (sem sessão, sem acesso) nem em pedidos que esgotaram o
      // tempo (seriam mais 15 s cada): só em falhas de rede/servidor.
      retry: (count, error) =>
        !(error instanceof ApiRequestError && error.status >= 400 && error.status < 500) && !isTimeout(error) && count < 2,
      // Sem rede, as queries ficam em pausa (networkMode "online") e voltam a pedir quando a
      // rede volta: um refetch falhado não troca a lista que já está no ecrã por um erro.
      refetchOnWindowFocus: false,
    },
    mutations: {
      // O mesmo para as mutations: o "Add task" ficava a rodar e a caixa marcada (otimista)
      // até voltar a rede. Assim falham já, com toast, e o otimista é reposto no onError.
      networkMode: "always",
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
