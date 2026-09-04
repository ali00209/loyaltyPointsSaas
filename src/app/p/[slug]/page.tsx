"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { VStack, HStack } from "@astryxdesign/core/Layout";
import { Center } from "@astryxdesign/core/Center";
import { Text, Heading } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { Link } from "@astryxdesign/core/Link";
import { Spinner } from "@astryxdesign/core/Spinner";
import { useToast } from "@astryxdesign/core/Toast";
import AppLoading from "@/components/AppLoading";
import {
  usePortalCustomer,
  usePortalLogin,
  usePortalSignup,
  usePortalTenant,
} from "@/lib/query";

function PortalLanding() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const showToast = useToast();
  const { data: tenant } = usePortalTenant(slug);
  const { data: customer, isLoading: customerLoading } = usePortalCustomer();
  const loginMutation = usePortalLogin();
  const signupMutation = usePortalSignup();
  const ref = searchParams.get("ref") ?? undefined;

  useEffect(() => {
    if (!customerLoading && customer) {
      router.replace(`/p/${slug}/overview`);
    }
  }, [customerLoading, customer, slug, router]);

  if (customerLoading || customer) {
    return <AppLoading label="Loading..." />;
  }

  const handleLogin = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const identifier = email.trim();
      await loginMutation.mutateAsync({
        ...(identifier.includes("@")
          ? { email: identifier }
          : { phone: identifier }),
        password,
      });
      router.push(`/p/${slug}/overview`);
    } catch (err) {
      showToast({
        type: "error",
        body: err instanceof Error ? err.message : "Failed to log in",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const identifier = email.trim();
      const result = await signupMutation.mutateAsync({
        name,
        ...(identifier.includes("@")
          ? { email: identifier }
          : { phone: identifier }),
        password,
        ref,
      });
      showToast({
        type: "info",
        body:
          result.referralPointsAwarded > 0
            ? `Welcome bonus +${result.signupPointsAwarded} pts. Your friend earned ${result.referralPointsAwarded} pts.`
            : `Welcome bonus +${result.signupPointsAwarded} pts.`,
      });
      router.push(`/p/${slug}/overview`);
    } catch (err) {
      showToast({
        type: "error",
        body: err instanceof Error ? err.message : "Failed to create account",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    void (mode === "login" ? handleLogin() : handleSignup());
  };

  return (
    <VStack gap={8} hAlign="center" width="100%" className="py-8">
      <VStack gap={2} hAlign="center">
        <Heading level={1} type="display-2">
          {tenant?.name ?? "Welcome"}
        </Heading>
        <Text type="body" color="secondary" size="lg">
          Earn points on every purchase
        </Text>
        <Text type="body" color="secondary" justify="center">
          Join our loyalty program and turn every order into rewards you can
          redeem anytime.
        </Text>
      </VStack>

      <Card padding={8} width="100%" className="max-w-md">
        <VStack gap={4} hAlign="stretch">
          <HStack gap={3} hAlign="center">
            <Button
              label="Log in"
              variant={mode === "login" ? "primary" : "ghost"}
              size="sm"
              onClick={() => setMode("login")}
            />
            <Button
              label="Sign up"
              variant={mode === "signup" ? "primary" : "ghost"}
              size="sm"
              onClick={() => setMode("signup")}
            />
          </HStack>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            noValidate
          >
            <VStack gap={2} hAlign="stretch">
              {mode === "signup" && (
                <TextInput
                  label="Full Name"
                  placeholder="Alex Johnson"
                  value={name}
                  onChange={setName}
                  isRequired
                />
              )}
              <TextInput
                label="Email or Phone"
                type="text"
                placeholder="you@example.com or +9203xxxxxx"
                value={email}
                onChange={setEmail}
                isRequired
              />
              <TextInput
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={setPassword}
                isRequired
              />
              {mode === "signup" && ref && (
                <Text type="supporting" color="secondary">
                  You were referred by a friend. Welcome!
                </Text>
              )}
              <Button
                label={
                  loading
                    ? mode === "login"
                      ? "Signing in..."
                      : "Creating account..."
                    : mode === "login"
                      ? "Log in"
                      : "Create account"
                }
                type="submit"
                variant="primary"
                size="lg"
                width="100%"
                isLoading={loading}
                isDisabled={
                  loading || !password || (mode === "signup" && !name)
                }
              />
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
                  setMode(mode === "login" ? "signup" : "login");
                }}
              >
                {mode === "login" ? "Sign up" : "Log in"}
              </Link>
            </Text>
          </VStack>
        </VStack>
      </Card>
    </VStack>
  );
}

export default function PortalPage() {
  return (
    <Suspense
      fallback={
        <Center axis="both" className="min-h-dvh">
          <Spinner size="lg" label="Loading..." />
        </Center>
      }
    >
      <PortalLanding />
    </Suspense>
  );
}
