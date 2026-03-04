"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/layout/container";
import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm } from "@/components/auth/register-form";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";

export default function AuthPage() {
  const { user } = useAuth();

  useEffect(() => {
    if (user) window.location.href = "/";
  }, [user]);

  if (user) return null;

  return (
    <section className="py-16">
      <Container className="max-w-3xl">
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-border/50 bg-card">
            <CardHeader>
              <CardTitle className="text-xl">Sign In</CardTitle>
            </CardHeader>
            <CardContent>
              <LoginForm />
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card">
            <CardHeader>
              <CardTitle className="text-xl">Create Account</CardTitle>
            </CardHeader>
            <CardContent>
              <RegisterForm />
            </CardContent>
          </Card>
        </div>
      </Container>
    </section>
  );
}
