"use client";

import { useState } from "react";
import { X, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitFeedback } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
}

export function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [alsoEmail, setAlsoEmail] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await submitFeedback(message.trim(), alsoEmail, email || undefined);
      setSent(true);
    } catch {
      // silently fail — feedback shouldn't block users
      setSent(true);
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setMessage("");
    setEmail("");
    setAlsoEmail(false);
    setSent(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-border/60 bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
          <div>
            <h2 className="font-semibold text-foreground">Share Your Feedback</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              We&apos;re in early access — your input shapes the app
            </p>
          </div>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          {sent ? (
            <div className="flex flex-col items-center py-8 text-center gap-3">
              <CheckCircle2 className="h-10 w-10 text-green-400" />
              <p className="font-medium text-foreground">Thank you!</p>
              <p className="text-sm text-muted-foreground">Your feedback helps us improve Orangutany.</p>
              <Button onClick={handleClose} className="mt-2 bg-primary text-primary-foreground hover:bg-primary/90">
                Close
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
                placeholder="What do you think? What's working well, what could be better? Bugs, ideas, anything..."
                rows={5}
                className="w-full resize-none rounded-lg border border-border/50 bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                autoFocus
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground/50">{message.length}/2000</span>
              </div>

              {!user && (
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email (optional)"
                  className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              )}

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={alsoEmail}
                  onChange={(e) => setAlsoEmail(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <span className="text-sm text-muted-foreground">
                  I&apos;d like to be contacted about my feedback
                </span>
              </label>

              <div className="flex gap-3 pt-1">
                <Button
                  variant="ghost"
                  onClick={handleClose}
                  className="flex-1 text-muted-foreground"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!message.trim() || sending}
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Feedback"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
