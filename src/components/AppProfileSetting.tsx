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
import type { User } from "@/types";

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

  const handleSaveProfile = async () => {
    const name = `${firstName} ${lastName}`.trim();
    if (!name) {
      showToast({ type: "error", body: "Name is required" });
      return;
    }
    try {
      await updateProfile.mutateAsync({ name, email });
      showToast({ type: "info", body: "Profile updated" });
    } catch (err) {
      showToast({
        type: "error",
        body: err instanceof Error ? err.message : "Failed to update profile",
      });
    }
  };

  const handleSavePassword = async () => {
    if (!currentPw) {
      showToast({ type: "error", body: "Current password is required" });
      return;
    }
    if (!newPw) {
      showToast({ type: "error", body: "New password is required" });
      return;
    }
    if (newPw.length < 6) {
      showToast({
        type: "error",
        body: "New password must be at least 6 characters",
      });
      return;
    }
    if (newPw !== confirmPw) {
      showToast({ type: "error", body: "Passwords do not match" });
      return;
    }
    try {
      await changePassword.mutateAsync({
        currentPassword: currentPw,
        newPassword: newPw,
      });
      showToast({ type: "info", body: "Password updated" });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err) {
      showToast({
        type: "error",
        body: err instanceof Error ? err.message : "Failed to change password",
      });
    }
  };

  return (
    <VStack gap={4}>
      <Card>
        <VStack gap={1} style={{ marginBottom: 10 }}>
          <Heading level={3}>Basic information</Heading>
          <Text type="supporting" color="secondary">
            View and update your personal details and account information.
          </Text>
        </VStack>
        <VStack gap={4}>
          <TextInput label="Username" value={username} onChange={setUsername} />
          <TextInput
            label="First name"
            value={firstName}
            onChange={setFirstName}
          />
          <TextInput
            label="Last name"
            value={lastName}
            onChange={setLastName}
          />
          <TextInput label="Email address" value={email} onChange={setEmail} />
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
          />
          <TextInput
            label="New password"
            type="password"
            value={newPw}
            onChange={setNewPw}
          />
          <TextInput
            label="Confirm password"
            type="password"
            value={confirmPw}
            onChange={setConfirmPw}
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
