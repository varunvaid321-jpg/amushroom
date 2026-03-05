"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoginForm } from "./login-form";
import { RegisterForm } from "./register-form";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "login" | "register";
}

export function AuthModal({ open, onOpenChange, defaultTab = "login" }: AuthModalProps) {
  const [tab, setTab] = useState<"login" | "register">(defaultTab);

  useEffect(() => {
    if (open) setTab(defaultTab);
  }, [open, defaultTab]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/50 bg-card" style={{ maxWidth: "28rem" }}>
        <DialogHeader>
          <DialogTitle className="text-sm font-medium text-muted-foreground">
            {tab === "login" ? "Sign In" : "Create Account"}
          </DialogTitle>
        </DialogHeader>
        <div className="mt-2">
          {tab === "login" ? (
            <>
              <LoginForm onSuccess={() => onOpenChange(false)} />
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{" "}
                <button
                  onClick={() => setTab("register")}
                  className="text-primary hover:underline"
                >
                  Create one
                </button>
              </p>
            </>
          ) : (
            <>
              <RegisterForm onSuccess={() => onOpenChange(false)} />
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <button
                  onClick={() => setTab("login")}
                  className="text-primary hover:underline"
                >
                  Sign in
                </button>
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
