import type { Role } from "@kampus/shared";
import { ClipboardList, Contact, LayoutDashboard, Map, NotebookPen, SquareCheckBig, UserRound, Users, type LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Fica só na sidebar do desktop (no telemóvel está no topo, no avatar). */
  desktopOnly?: boolean;
  end?: boolean;
}

export const NAV: Record<Role, NavItem[]> = {
  student: [
    { to: "/app", label: "Home", icon: LayoutDashboard, end: true },
    { to: "/app/tasks", label: "Tasks", icon: SquareCheckBig },
    { to: "/app/notes", label: "Notes", icon: NotebookPen },
    { to: "/app/tour", label: "Tour", icon: Map },
    { to: "/app/contacts", label: "Contacts", icon: Contact },
    { to: "/app/profile", label: "Profile", icon: UserRound, desktopOnly: true },
  ],
  staff: [
    { to: "/staff", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/staff/students", label: "Students", icon: Users },
    { to: "/staff/assignments", label: "Cohort tasks", icon: ClipboardList },
    { to: "/staff/profile", label: "Profile", icon: UserRound },
  ],
};

export const HOME: Record<Role, string> = { student: "/app", staff: "/staff" };
