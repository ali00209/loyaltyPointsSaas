"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { VStack, HStack } from "@astryxdesign/core/Layout";
import { Center } from "@astryxdesign/core/Center";
import { Text, Heading } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Link } from "@astryxdesign/core/Link";
import { Divider } from "@astryxdesign/core/Divider";
import { Icon } from "@astryxdesign/core/Icon";
import { Spinner } from "@astryxdesign/core/Spinner";
import { useToast } from "@astryxdesign/core/Toast";
import {
  useCurrentUser,
  useLogin,
  useRegister,
  useSeedDemo,
} from "@/lib/query";
import { ApiError } from "@/lib/api";
import { LoginSchema, RegisterSchema } from "@/lib/validations/schemas";
import { useFieldStatus } from "@/lib/use-field-status";

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("demo@loyaltyapp.com");
  const [password, setPassword] = useState("demo123");
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const showToast = useToast();
  const { data: user, isLoading: checkingAuth } = useCurrentUser();
  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const seedMutation = useSeedDemo();

  const dev = process.env.NODE_ENV === 'development'

  const [authServer, setAuthServer] = useState<ApiError["details"]>();
  const authStatus = useFieldStatus(
    mode === "login" ? LoginSchema : RegisterSchema,
    mode === "login"
      ? { email, password }
      : { email, password, name, businessName },
    authServer,
  );

  useEffect(() => {
    if (!checkingAuth && user) {
      router.push(user.role === "admin" ? "/admin" : "/dashboard");
    }
  }, [checkingAuth, user, router]);

  const handleSeedAndLogin = async () => {
    if (seeding || loading) return;
    setSeeding(true);
    try {
      await seedMutation.mutateAsync();
      await loginMutation.mutateAsync({
        email: "demo@loyaltyapp.com",
        password: "demo123",
      });
      router.push("/dashboard");
    } catch {
      showToast({ type: "error", body: "Failed to seed demo data" });
    } finally {
      setSeeding(false);
    }
  };

  const reportAuthError = (err: unknown) => {
    if (err instanceof ApiError && err.details) {
      setAuthServer(err.details);
      return;
    }
    showToast({
      type: "error",
      body:
        err instanceof Error
          ? err.message
          : "Network error. Please try again.",
    });
  };

  const handleSubmit = async () => {
    if (loading) return;
    authStatus.revealAll();
    setAuthServer(undefined);
    setLoading(true);

    try {
      if (mode === "login") {
        const parsed = LoginSchema.safeParse({ email, password });
        if (!parsed.success) return;
        const loggedIn = await loginMutation.mutateAsync(parsed.data);
        router.push(loggedIn.role === "admin" ? "/admin" : "/dashboard");
      } else {
        const parsed = RegisterSchema.safeParse({
          email,
          password,
          name,
          businessName,
        });
        if (!parsed.success) return;
        const registered = await registerMutation.mutateAsync(parsed.data);
        router.push(registered.role === "admin" ? "/admin" : "/dashboard");
      }
    } catch (err) {
      reportAuthError(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === "login" ? "register" : "login");
    // Login and register enforce different rules; stale errors must not carry over.
    setAuthServer(undefined);
    authStatus.reset();
  };

  if (checkingAuth) {
    return (
      <Center axis="both" className="min-h-dvh bg-body">
        <Spinner size="lg" label="Loading..." />
      </Center>
    );
  }

  return (
    <Center axis="both" className="min-h-dvh bg-body px-6 py-6">
      <VStack gap={4} hAlign="center" width="100%" className="max-w-[400px]">
        <VStack gap={2} hAlign="center">
          <HStack
            width={48}
            height={48}
            hAlign="center"
            vAlign="center"
            className="rounded-lg bg-(--color-brand-gold) text-(--color-brand-ink)"
          >
            <Icon icon={Star} size="lg" />
          </HStack>
          <Text type="body" weight="bold" size="lg">
            LoyaltyHub
          </Text>
        </VStack>

        <Card padding={8} width="100%">
          <VStack gap={4} hAlign="stretch">
            <VStack gap={1} hAlign="center">
              <Heading level={2}>
                {mode === "login" ? "Welcome back" : "Create your account"}
              </Heading>
              <Text type="body" color="secondary" size="sm">
                {mode === "login"
                  ? "Sign in to manage your loyalty program"
                  : "Start building customer loyalty today"}
              </Text>
            </VStack>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSubmit();
              }}
              noValidate
            >
              <VStack gap={2} hAlign="stretch">
                {mode === "register" && (
                  <>
                    <TextInput
                      label="Full Name"
                      placeholder="Alex Johnson"
                      value={name}
                      onChange={setName}
                      onBlur={() => authStatus.onBlur("name")}
                      status={authStatus.statusFor("name")}
                      isRequired
                    />
                    <TextInput
                      label="Business Name"
                      placeholder="My Coffee Shop"
                      value={businessName}
                      onChange={setBusinessName}
                      isOptional
                    />
                  </>
                )}
                <TextInput
                  label="Email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={setEmail}
                  onBlur={() => authStatus.onBlur("email")}
                  status={authStatus.statusFor("email")}
                  isRequired
                />
                <TextInput
                  label="Password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={setPassword}
                  onBlur={() => authStatus.onBlur("password")}
                  status={authStatus.statusFor("password")}
                  isRequired
                />
                <Button
                  label={
                    loading
                      ? mode === "login"
                        ? "Signing in..."
                        : "Creating account..."
                      : mode === "login"
                        ? "Sign In"
                        : "Create Account"
                  }
                  type="submit"
                  variant="primary"
                  size="lg"
                  width="100%"
                  isLoading={loading}
                />
                {dev && (<Button
                  label='seed'
                  type="button"
                  variant="primary"
                  size="lg"
                  width="100%"
                  onClick={handleSeedAndLogin}
                  isLoading={loading}
                />)}
              </VStack>
            </form>

            <Divider label="or" />

            <VStack hAlign="center">
              <Text type="supporting" color="secondary">
                {mode === "login"
                  ? "Don't have an account?"
                  : "Already have an account?"}{" "}
                <Link
                  href="#"
                  type="supporting"
                  onClick={(e) => {
                    e.preventDefault();
                    toggleMode();
                  }}
                >
                  {mode === "login" ? "Sign up" : "Sign in"}
                </Link>
              </Text>
            </VStack>
          </VStack>
        </Card>
      </VStack>
    </Center>
  );
}
