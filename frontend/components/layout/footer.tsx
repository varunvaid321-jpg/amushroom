import Link from "next/link";
import Image from "next/image";
import { Container } from "./container";

export function Footer() {
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
        <div className="flex gap-6">
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
        <a
          href="mailto:support@orangutany.com"
          className="hover:text-foreground transition-colors"
        >
          support@orangutany.com
        </a>
      </Container>
    </footer>
  );
}
