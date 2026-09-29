"use client";

import {
  VStack,
  TextInput,
  HStack,
  Button,
  Divider,
  Heading,
  Text,
  Card,
} from "@astryxdesign/core";
import { useState } from "react";
import { useToast } from "@astryxdesign/core/Toast";
import {
  useCurrentUser,
  useUpdateProfile,
  useChangePassword,
} from "@/lib/query";
import { ApiError } from "@/lib/api";
import {
  ChangePasswordSchema,
  ConfirmPasswordSchema,
  UpdateProfileSchema,
} from "@/lib/validations/schemas";
import { useFieldStatus } from "@/lib/use-field-status";
import type { User } from "@/types";
import AppHeader from "./AppHeader";

function ProfileForm({ user }: { user: User }) {
  const showToast = useToast();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();

  const parts = user.name.split(" ");
  const [firstName, setFirstName] = useState(parts[0] ?? "");
  const [lastName, setLastName] = useState(parts.slice(1).join(" ") || "");
  const [username, setUsername] = useState(user.email.split("@")[0] ?? "");
  const [email, setEmail] = useState(user.email);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const profileValues = { name: `${firstName} ${lastName}`.trim(), email };
  const [profileServer, setProfileServer] = useState<ApiError["details"]>();
  const profile = useFieldStatus(
    UpdateProfileSchema,
    profileValues,
    profileServer,
  );

  const passwordValues = {
    currentPassword: currentPw,
    newPassword: newPw,
    confirmPassword: confirmPw,
  };
  const [passwordServer, setPasswordServer] = useState<ApiError["details"]>();
  const password = useFieldStatus(
    ConfirmPasswordSchema,
    passwordValues,
    passwordServer,
  );

  const handleSaveProfile = async () => {
    profile.revealAll();
    const parsed = UpdateProfileSchema.safeParse(profileValues);
    if (!parsed.success) return;
    setProfileServer(undefined);
    try {
      await updateProfile.mutateAsync(parsed.data);
      showToast({ type: "info", body: "Profile updated" });
    } catch (err) {
      if (err instanceof ApiError && err.details) {
        profile.revealAll();
        setProfileServer(err.details);
        return;
      }
      showToast({
        type: "error",
        body: err instanceof Error ? err.message : "Failed to update profile",
      });
    }
  };

  const handleSavePassword = async () => {
    password.revealAll();
    const parsed = ConfirmPasswordSchema.safeParse(passwordValues);
    if (!parsed.success) return;
    setPasswordServer(undefined);
    try {
      await changePassword.mutateAsync({
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
      });
      showToast({ type: "info", body: "Password updated" });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      password.reset();
    } catch (err) {
      if (err instanceof ApiError && err.details) {
        password.revealAll();
        setPasswordServer(err.details);
        return;
      }
      showToast({
        type: "error",
        body: err instanceof Error ? err.message : "Failed to change password",
      });
    }
  };

  return (
    <VStack gap={4}>
      <AppHeader
        heading="Profile"
        description="Update your Profile"
        showButton={false}
        showSearch={false}
      />
      <Card>
        <VStack gap={1} style={{ marginBottom: 10 }}>
          <Heading level={3}>Basic information</Heading>
          <Text type="supporting" color="secondary">
            View and update your personal details and account information.
          </Text>
        </VStack>
        <VStack gap={4}>
          <TextInput
            label="Username"
            value={username}
            onChange={setUsername}
          />
          <TextInput
            label="First name"
            value={firstName}
            onChange={setFirstName}
            onBlur={() => profile.onBlur("name")}
            status={profile.statusFor("name")}
          />
          <TextInput
            label="Last name"
            value={lastName}
            onChange={setLastName}
            onBlur={() => profile.onBlur("name")}
          />
          <TextInput
            label="Email address"
            value={email}
            onChange={setEmail}
            onBlur={() => profile.onBlur("email")}
            status={profile.statusFor("email")}
          />
          <HStack>
            <Button
              label="Save"
              variant="primary"
              isLoading={updateProfile.isPending}
              onClick={handleSaveProfile}
            />
          </HStack>
        </VStack>
      </Card>

      <Divider />

      <Card>
        <VStack gap={1} style={{ marginBottom: 10 }}>
          <Heading level={3}>Change password</Heading>
          <Text type="supporting" color="secondary">
            Update your password to keep your account secure.
          </Text>
        </VStack>
        <VStack gap={4}>
          <TextInput
            label="Verify current password"
            type="password"
            value={currentPw}
            onChange={setCurrentPw}
            onBlur={() => password.onBlur("currentPassword")}
            status={password.statusFor("currentPassword")}
          />
          <TextInput
            label="New password"
            type="password"
            value={newPw}
            onChange={setNewPw}
            onBlur={() => password.onBlur("newPassword")}
            status={password.statusFor("newPassword")}
          />
          <TextInput
            label="Confirm password"
            type="password"
            value={confirmPw}
            onChange={setConfirmPw}
            onBlur={() => password.onBlur("confirmPassword")}
            status={password.statusFor("confirmPassword")}
          />
          <HStack>
            <Button
              label="Save"
              variant="primary"
              isLoading={changePassword.isPending}
              onClick={handleSavePassword}
            />
          </HStack>
        </VStack>
      </Card>
    </VStack>
  );
}

export default function AppProfileSetting() {
  const { data: currentUser, isLoading } = useCurrentUser();

  if (isLoading) {
    return (
      <VStack gap={4}>
        <Card>
          <VStack gap={1}>
            <Heading level={3}>Loading...</Heading>
          </VStack>
        </Card>
      </VStack>
    );
  }

  if (!currentUser) {
    return (
      <VStack gap={4}>
        <Card>
          <VStack gap={1}>
            <Heading level={3}>Not signed in</Heading>
          </VStack>
        </Card>
      </VStack>
    );
  }

  return <ProfileForm key={currentUser.id} user={currentUser} />;
}
