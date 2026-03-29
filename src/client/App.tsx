import { useCallback, useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import { api } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { Library } from "@/pages/Library";
import { BookDetail } from "@/pages/BookDetail";
import { AddBook } from "@/pages/AddBook";
import { Authors } from "@/pages/Authors";
import { AuthorDetail } from "@/pages/AuthorDetail";
import { Stats } from "@/pages/Stats";
import { Login } from "@/pages/Login";

type AuthState = "loading" | "login" | "setup" | "authenticated";

export default function App() {
  const [authState, setAuthState] = useState<AuthState>("loading");

  const checkAuth = useCallback(() => {
    api.auth
      .me()
      .then((data) => {
        setAuthState(data.needsPassword ? "setup" : "authenticated");
      })
      .catch(() => {
        setAuthState("login");
      });
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (authState === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    );
  }

  if (authState === "login" || authState === "setup") {
    return (
      <Login
        needsPassword={authState === "setup"}
        onSuccess={checkAuth}
      />
    );
  }

  return (
    <AppShell onLogout={() => setAuthState("login")}>
      <Routes>
        <Route path="/" element={<Library />} />
        <Route path="/books/new" element={<AddBook />} />
        <Route path="/books/:id" element={<BookDetail />} />
        <Route path="/authors" element={<Authors />} />
        <Route path="/authors/:id" element={<AuthorDetail />} />
        <Route path="/stats" element={<Stats />} />
      </Routes>
    </AppShell>
  );
}
