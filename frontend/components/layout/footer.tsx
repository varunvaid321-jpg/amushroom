"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Container } from "./container";
import { FeedbackModal } from "@/components/feedback/feedback-modal";

export function Footer() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <footer className="border-t border-border/50 py-8">
      <Container className="flex flex-col items-center gap-4 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <Image
          src="/images/logo.png"
          alt="Orangutany"
          width={96}
          height={24}
          className="h-6 w-auto opacity-70"
        />
        <div className="flex flex-wrap justify-center gap-6">
          <Link href="/about" className="hover:text-foreground transition-colors">
            About Us
          </Link>
          <a href="https://guide.orangutany.com" className="hover:text-foreground transition-colors">
            Learn
          </a>
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
          <Link href="/refund" className="hover:text-foreground transition-colors">
            Refunds
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setFeedbackOpen(true)}
            className="hover:text-foreground transition-colors"
          >
            Share Feedback
          </button>
          <a
            href="mailto:support@orangutany.com"
            className="hover:text-foreground transition-colors"
          >
            support@orangutany.com
          </a>
        </div>
      </Container>
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </footer>
  );
}
