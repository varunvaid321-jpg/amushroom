"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Container } from "./container";
import { Menu, X, MessageSquare, BookOpen, Sparkles, Crown } from "lucide-react";
import { FeedbackModal } from "@/components/feedback/feedback-modal";
import { scrollToId } from "@/lib/scroll";
import { useUpgrade } from "@/hooks/use-upgrade";

export function Header() {
  const { user, isAdmin, loading, logout, openAuthModal } = useAuth();
  const { openUpgrade } = useUpgrade();
  const [menuOpen, setMenuOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isPro = user?.tier === "pro" || user?.tier === "pro_lifetime";
  const showUpgrade = !!user && !isPro;

  function navTo(hash: string) {
    setMenuOpen(false);
    if (isHome) {
      scrollToId(hash);
    } else {
      window.location.href = `/#${hash}`;
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background">
      <Container className="flex h-16 items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link href="/" className="flex items-center">
            <Image
              src="/images/logo-mushroom-id.png"
              alt="Orangutany Mushroom ID"
              width={160}
              height={50}
              className="h-12 w-auto"
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
        <nav className="flex shrink-0 items-center gap-2 sm:gap-3">
          {loading ? null : user ? (
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="text-xs sm:text-sm font-medium text-foreground truncate max-w-[60px] sm:max-w-[120px]">
                Hi, {user.name || user.email}
              </span>
              {isPro && (
                <Link
                  href="/account/billing"
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    user?.tier === "pro_lifetime"
                      ? "bg-purple-500/15 text-purple-400 hover:bg-purple-500/25"
                      : "bg-green-500/15 text-green-400 hover:bg-green-500/25"
                  }`}
                >
                  <Crown className="h-3 w-3" />
                  <span className="hidden sm:inline">{user?.tier === "pro_lifetime" ? "Lifetime" : "Pro"}</span>
                </Link>
              )}
              {showUpgrade && (
                <button
                  onClick={openUpgrade}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/25 transition-colors"
                >
                  <Sparkles className="h-3 w-3" />
                  <span className="hidden sm:inline">Upgrade</span>
                  <span className="sm:hidden">Pro</span>
                </button>
              )}
              {isAdmin && (
                <Link href="/admin">
                  <Button variant="ghost" size="sm" className="text-primary h-8 px-2 text-xs sm:text-sm sm:px-3">
                    Admin
                  </Button>
                </Link>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => { await logout(); window.location.href = "/"; }}
                className="text-muted-foreground hover:text-foreground h-8 px-2 text-xs sm:text-sm sm:px-3"
              >
                Logout
              </Button>
            </div>
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
              {(!user || showUpgrade) && (
                <button
                  onClick={() => { setMenuOpen(false); openUpgrade(); }}
                  className="w-full text-left px-3 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  Upgrade to Pro
                </button>
              )}
              <a
                href="https://guide.orangutany.com/mushrooms"
                onClick={() => setMenuOpen(false)}
                className="px-3 py-2.5 text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-muted/30 rounded-lg transition-colors"
              >
                Learn About Mushrooms
              </a>
              {user && (
                <>
                  <button
                    onClick={() => navTo("library")}
                    className="w-full text-left px-3 py-2.5 text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-muted/30 rounded-lg transition-colors"
                  >
                    My Identifications
                  </button>
                  <Link
                    href="/account/billing"
                    onClick={() => setMenuOpen(false)}
                    className="px-3 py-2.5 text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-muted/30 rounded-lg transition-colors"
                  >
                    Account & Billing
                  </Link>
                </>
              )}
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
              <a
                href="https://guide.orangutany.com/newsletter"
                onClick={() => setMenuOpen(false)}
                className="px-3 py-2.5 text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-muted/30 rounded-lg transition-colors"
              >
                Newsletter
              </a>
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
