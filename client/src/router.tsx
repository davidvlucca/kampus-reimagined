import type { Role } from "@kampus/shared";
import { createBrowserRouter, Navigate, type RouteObject } from "react-router";
import { FullPageSpinner } from "./components/ui/index.ts";
import { RequireAuth } from "./components/layout/RequireAuth.tsx";
import { LoginPage } from "./features/public/LoginPage.tsx";
import { NotFoundPage } from "./features/public/NotFoundPage.tsx";
import { RouteErrorPage } from "./features/public/RouteErrorPage.tsx";
import { WelcomePage } from "./features/public/WelcomePage.tsx";

// Só as páginas públicas vêm no arranque. O resto carrega à parte (code splitting): quem só
// vê a entrada e o login não descarrega a app, um aluno não descarrega o código do staff, e
// a visita só vem quando é aberta. O React Router pede o chunk do layout e o da página ao
// mesmo tempo.
const lazyShell = (role: Role) => async () => {
  const { AppShell } = await import("./components/layout/AppShell.tsx");
  return { element: <AppShell role={role} /> };
};
const lazyDashboard = async () => ({ Component: (await import("./features/student/DashboardPage.tsx")).DashboardPage });
const lazyTasks = async () => ({ Component: (await import("./features/student/TasksPage.tsx")).TasksPage });
const lazyNotes = async () => ({ Component: (await import("./features/student/NotesPage.tsx")).NotesPage });
const lazyContacts = async () => ({ Component: (await import("./features/contacts/ContactsPage.tsx")).ContactsPage });
const lazyProfile = async () => ({ Component: (await import("./features/profile/ProfilePage.tsx")).ProfilePage });
const lazyTour = async () => ({ Component: (await import("./features/tour/TourPage.tsx")).TourPage });
const lazyStaffDashboard = async () => ({ Component: (await import("./features/staff/StaffDashboardPage.tsx")).StaffDashboardPage });
const lazyStudents = async () => ({ Component: (await import("./features/staff/StudentsPage.tsx")).StudentsPage });
const lazyAssignments = async () => ({ Component: (await import("./features/staff/AssignmentsPage.tsx")).AssignmentsPage });

const routes: RouteObject[] = [
  // Público
  { path: "/", element: <WelcomePage /> },
  // Um /login sem perfil vai para o de aluno (a Vercel responde 308 antes de chegar aqui).
  { path: "/login", element: <Navigate to="/login/student" replace /> },
  { path: "/login/student", element: <LoginPage portal="student" /> },
  { path: "/login/staff", element: <LoginPage portal="staff" /> },

  // Aluno
  {
    element: <RequireAuth role="student" />,
    children: [
      // A visita ocupa o ecrã inteiro, fora do layout com menu.
      { path: "/app/tour", lazy: lazyTour },
      {
        path: "/app",
        lazy: lazyShell("student"),
        children: [
          { index: true, lazy: lazyDashboard },
          { path: "tasks", lazy: lazyTasks },
          { path: "notes", lazy: lazyNotes },
          { path: "notes/:noteId", lazy: lazyNotes },
          { path: "contacts", lazy: lazyContacts },
          { path: "profile", lazy: lazyProfile },
        ],
      },
    ],
  },

  // Staff
  {
    element: <RequireAuth role="staff" />,
    children: [
      {
        path: "/staff",
        lazy: lazyShell("staff"),
        children: [
          { index: true, lazy: lazyStaffDashboard },
          { path: "students", lazy: lazyStudents },
          { path: "assignments", lazy: lazyAssignments },
          { path: "profile", lazy: lazyProfile },
        ],
      },
    ],
  },

  { path: "*", element: <NotFoundPage /> },
];

export const router = createBrowserRouter([
  {
    // Rota raiz sem caminho, só para o errorElement: um erro de render ou um chunk que não
    // carrega (deploy novo com o separador aberto) mostra uma página da app, não a stack.
    errorElement: <RouteErrorPage />,
    // Abrir de raiz uma rota lazy (/app/tour, /staff...) espera pelo chunk antes do primeiro
    // render: mostra o spinner nesse intervalo (sem isto o React Router avisava na consola).
    hydrateFallbackElement: <FullPageSpinner />,
    children: routes,
  },
]);
