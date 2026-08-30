import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { FolderTree, Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/vocab")({
  component: AdminVocabLayout,
  head: () => ({ meta: [{ title: "Vocab — Admin" }] }),
});

const SUB_NAV = [
  { to: "/admin/vocab", label: "Import", icon: Upload, exact: true },
  { to: "/admin/vocab/decks", label: "Manage decks", icon: FolderTree },
] as const;

function AdminVocabLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {SUB_NAV.map((item) => {
          const Icon = item.icon;
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={
                "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition " +
                (active
                  ? "bg-brand-600 text-white shadow-brand ring-1 ring-brand-400/50"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50")
              }
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </div>
      <Outlet />
    </div>
  );
}
