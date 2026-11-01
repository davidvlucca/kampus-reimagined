import { createBrowserRouter } from "react-router";
import { AppShell } from "./components/layout/AppShell.tsx";
import { RequireAuth } from "./components/layout/RequireAuth.tsx";
import { ContactsPage } from "./features/contacts/ContactsPage.tsx";
import { ProfilePage } from "./features/profile/ProfilePage.tsx";
import { LoginPage } from "./features/public/LoginPage.tsx";
import { NotFoundPage } from "./features/public/NotFoundPage.tsx";
import { WelcomePage } from "./features/public/WelcomePage.tsx";
import { DashboardPage } from "./features/student/DashboardPage.tsx";
import { NotesPage } from "./features/student/NotesPage.tsx";
import { TasksPage } from "./features/student/TasksPage.tsx";

// A visita e a área de staff carregam à parte (code splitting): um aluno não descarrega
// o código do staff, e a visita só vem quando é aberta.
const lazyTour = async () => ({ Component: (await import("./features/tour/TourPage.tsx")).TourPage });
const lazyStaffDashboard = async () => ({ Component: (await import("./features/staff/StaffDashboardPage.tsx")).StaffDashboardPage });
const lazyStudents = async () => ({ Component: (await import("./features/staff/StudentsPage.tsx")).StudentsPage });
const lazyAssignments = async () => ({ Component: (await import("./features/staff/AssignmentsPage.tsx")).AssignmentsPage });

export const router = createBrowserRouter([
  // Público
  { path: "/", element: <WelcomePage /> },
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
        element: <AppShell role="student" />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: "tasks", element: <TasksPage /> },
          { path: "notes", element: <NotesPage /> },
          { path: "notes/:noteId", element: <NotesPage /> },
          { path: "contacts", element: <ContactsPage /> },
          { path: "profile", element: <ProfilePage /> },
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
        element: <AppShell role="staff" />,
        children: [
          { index: true, lazy: lazyStaffDashboard },
          { path: "students", lazy: lazyStudents },
          { path: "assignments", lazy: lazyAssignments },
          { path: "profile", element: <ProfilePage /> },
        ],
      },
    ],
  },

  { path: "*", element: <NotFoundPage /> },
]);
