"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Container } from "./container";
import { Menu, X, MessageSquare, BookOpen } from "lucide-react";
import { FeedbackModal } from "@/components/feedback/feedback-modal";

export function Header() {
  const { user, isAdmin, loading, logout, openAuthModal } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/";

  function navTo(hash: string) {
    setMenuOpen(false);
    if (isHome) {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" });
    } else {
      window.location.href = `/#${hash}`;
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background">
      <Container className="flex h-16 items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors self-center mt-5"
            aria-label="Menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link href="/" className="flex items-center">
            <Image
              src="/images/logo.png"
              alt="Orangutany"
              width={160}
              height={40}
              className="h-10 w-auto"
              priority
            />
          </Link>
          <a
            href="https://guide.orangutany.com/mushrooms"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Learn About Mushrooms
          </a>
        </div>
        <nav className="flex items-center gap-3">
          {loading ? null : user ? (
            <>
              <span className="hidden sm:inline text-sm text-muted-foreground truncate max-w-[120px]">
                Hi, {user.name || user.email}
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

      {/* Slide-down menu */}
      {menuOpen && (
        <div className="border-t border-border/50 bg-background">
          <Container>
            <nav className="flex flex-col py-3 gap-1">
              <button
                onClick={() => navTo("upload")}
                className="w-full text-left px-3 py-2.5 text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-muted/30 rounded-lg transition-colors"
              >
                Identify a Mushroom
              </button>
              {user && (
                <button
                  onClick={() => navTo("library")}
                  className="w-full text-left px-3 py-2.5 text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-muted/30 rounded-lg transition-colors"
                >
                  My Library
                </button>
              )}
              <a
                href="https://guide.orangutany.com/mushrooms"
                onClick={() => setMenuOpen(false)}
                className="px-3 py-2.5 text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-muted/30 rounded-lg transition-colors"
              >
                Learn About Mushrooms
              </a>
              <Link
                href="/resources"
                onClick={() => setMenuOpen(false)}
                className="px-3 py-2.5 text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-muted/30 rounded-lg transition-colors"
              >
                External Resources
              </Link>
              <Link
                href="/about"
                onClick={() => setMenuOpen(false)}
                className="px-3 py-2.5 text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-muted/30 rounded-lg transition-colors"
              >
                About
              </Link>
              <div className="my-1 h-px bg-border/40" />
              <button
                onClick={() => { setMenuOpen(false); setFeedbackOpen(true); }}
                className="w-full text-left px-3 py-2.5 text-sm font-medium text-primary/80 hover:text-primary hover:bg-muted/30 rounded-lg transition-colors flex items-center gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                Share Feedback
              </button>
            </nav>
          </Container>
        </div>
      )}
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </header>
  );
}
