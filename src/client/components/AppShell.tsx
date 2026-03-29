import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Plus, Users, Library, LogOut, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { SearchBar } from "@/components/SearchBar";

const navItems = [
  { to: "/", label: "Books", icon: Library },
  { to: "/authors", label: "Authors", icon: Users },
  { to: "/stats", label: "Stats", icon: BarChart3 },
];

export function AppShell({ children, onLogout }: { children: ReactNode; onLogout: () => void }) {
  const location = useLocation();

  async function handleLogout() {
    await api.auth.logout();
    onLogout();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4 sm:gap-6">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <img src="/logo.svg" alt="Alexandria" className="h-6 w-6" />
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground sm:px-3",
                  location.pathname === item.to
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:block">
              <SearchBar />
            </div>
            <Button size="sm" asChild>
              <Link to="/books/new">
                <Plus className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Add Book</span>
              </Link>
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleLogout} title="Logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="mx-auto max-w-5xl border-t px-4 py-2 sm:hidden">
          <SearchBar />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      <Toaster />
    </div>
  );
}
