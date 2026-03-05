"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { GoogleButton } from "./google-button";

export function RegisterForm({ onSuccess }: { onSuccess?: () => void } = {}) {
  const { register, googleAuthEnabled } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 10) {
      setError("Password must be at least 10 characters");
      return;
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Password must contain both letters and numbers");
      return;
    }

    setLoading(true);
    try {
      // Include honeypot field if filled (bots only)
      const honeypot = (document.querySelector('input[name="website"]') as HTMLInputElement)?.value;
      if (honeypot) {
        // Bot detected — pretend success
        if (onSuccess) onSuccess();
        return;
      }
      await register(name, email, password);
      if (onSuccess) onSuccess();
      else window.location.href = "/";
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("__email_exists__");
      } else {
        setError(err instanceof ApiError ? err.message : "Registration failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
      {/* Honeypot — hidden from real users, bots fill it */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="absolute -left-[9999px] h-0 w-0 opacity-0" aria-hidden="true" />
      <div className="space-y-2">
        <Label htmlFor="reg-name">Name</Label>
        <Input
          id="reg-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          autoComplete="name"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reg-email">Email</Label>
        <Input
          id="reg-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          autoComplete="email"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reg-password">Password</Label>
        <div className="relative">
          <Input
            id="reg-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 10 chars, letters + numbers"
            required
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="reg-confirm">Confirm Password</Label>
        <Input
          id="reg-confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm password"
          required
          autoComplete="new-password"
        />
      </div>
      {error === "__email_exists__" ? (
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-foreground">
          <p>An account with this email already exists.</p>
          <p className="mt-1 text-muted-foreground">
            <a href="/" className="text-primary hover:underline">Sign in</a>
            {" or "}
            <a href="/forgot-password" className="text-primary hover:underline">reset your password</a>
          </p>
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}
      <Button
        type="submit"
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
        disabled={loading}
      >
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Create Account
      </Button>
      {googleAuthEnabled && (
        <>
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>
          <GoogleButton />
        </>
      )}
    </form>
  );
}
