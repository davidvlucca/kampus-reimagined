import { createBrowserRouter } from "react-router";
import { AppShell } from "./components/layout/AppShell.tsx";
import { RequireAuth } from "./components/layout/RequireAuth.tsx";
import { ContactsPage } from "./features/contacts/ContactsPage.tsx";
import { ProfilePage } from "./features/profile/ProfilePage.tsx";
import { LoginPage } from "./features/public/LoginPage.tsx";
import { NotFoundPage } from "./features/public/NotFoundPage.tsx";
import { WelcomePage } from "./features/public/WelcomePage.tsx";
import { StaffDashboardPage } from "./features/staff/StaffDashboardPage.tsx";
import { StudentsPage } from "./features/staff/StudentsPage.tsx";
import { DashboardPage } from "./features/student/DashboardPage.tsx";
import { NotesPage } from "./features/student/NotesPage.tsx";
import { TasksPage } from "./features/student/TasksPage.tsx";
import { TourPage } from "./features/tour/TourPage.tsx";

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
      { path: "/app/tour", element: <TourPage /> },
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
          { index: true, element: <StaffDashboardPage /> },
          { path: "students", element: <StudentsPage /> },
          { path: "profile", element: <ProfilePage /> },
        ],
      },
    ],
  },

  { path: "*", element: <NotFoundPage /> },
]);
