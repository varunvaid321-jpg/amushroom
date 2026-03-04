"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Container } from "./container";
import { LogOut, Camera, BookOpen } from "lucide-react";

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

export function Header() {
  const { user, isAdmin, loading, logout, openAuthModal } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-sm">
      <Container className="flex h-16 items-center justify-between">
        <div className="flex items-center gap-4">
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
          {!loading && (
            <nav className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => scrollTo("upload")}
                className="text-muted-foreground hover:text-foreground"
              >
                <Camera className="mr-1 h-4 w-4" />
                Identify
              </Button>
              {user && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => scrollTo("library")}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <BookOpen className="mr-1 h-4 w-4" />
                  Library
                </Button>
              )}
            </nav>
          )}
        </div>
        <nav className="flex items-center gap-3">
          {loading ? null : user ? (
            <>
              <span className="hidden text-sm text-muted-foreground sm:inline">
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
                <span className="hidden sm:inline">Logout</span>
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
