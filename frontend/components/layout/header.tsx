"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Container } from "./container";
import { LogOut, User } from "lucide-react";

export function Header() {
  const { user, isAdmin, loading, logout, openAuthModal } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background">
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/images/logo.png"
            alt="Orangutany"
            width={160}
            height={40}
            className="h-10 w-auto"
            priority
          />
        </Link>
        <nav className="flex items-center gap-3">
          {loading ? null : user ? (
            <>
              <span className="text-sm text-muted-foreground">
                Welcome, {user.name || user.email}
              </span>
              {isAdmin && (
                <Link href="/admin">
                  <Button variant="ghost" size="sm" className="text-primary">
                    Admin
                  </Button>
                </Link>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="mr-1 h-4 w-4" />
                Logout
              </Button>
            </>
          ) : (
            <>
              <button onClick={() => openAuthModal("login")} className="text-sm text-muted-foreground hover:text-foreground">
                Log in
              </button>
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => openAuthModal("register")}>
                Sign Up Free
              </Button>
            </>
          )}
        </nav>
      </Container>
    </header>
  );
}
