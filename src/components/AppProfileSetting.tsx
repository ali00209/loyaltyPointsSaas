"use client";

import {
  VStack,
  TextInput,
  HStack,
  Button,
  Divider,
  CheckboxInput,
  Grid,
  Heading,
  Text,
  Card,
} from "@astryxdesign/core";
import { useState } from "react";

export default function AppProfileSetting() {
  const [username, setUsername] = useState("nicol43");
  const [firstName, setFirstName] = useState("Stephanie");
  const [lastName, setLastName] = useState("Nicol");
  const [email, setEmail] = useState("stephanie_nicol@mail.com");
  const [currentPw, setCurrentPw] = useState("password123");
  const [newPw, setNewPw] = useState("password123");
  const [confirmPw, setConfirmPw] = useState("password123");
  const [dataExport, setDataExport] = useState(false);
  const [adminMembers, setAdminMembers] = useState(false);
  const [twoFactor, setTwoFactor] = useState(false);

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
            <Button label="Save" variant="primary" />
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
            <Button label="Save" variant="primary" />
          </HStack>
        </VStack>
      </Card>

      <Divider />

      <Card>
        <VStack gap={1} style={{ marginBottom: 10 }}>
          <Heading level={3}>Advanced settings</Heading>
          <Text type="supporting" color="secondary">
            Configure detailed account preferences and security options.
          </Text>
        </VStack>
        <VStack gap={5}>
          <CheckboxInput
            label="Data Export Access"
            description="Allow export of personal data and backups."
            value={dataExport}
            onChange={setDataExport}
          />
          <CheckboxInput
            label="Allow Admin to Add Members"
            description="Admins can invite and manage members."
            value={adminMembers}
            onChange={setAdminMembers}
          />
          <CheckboxInput
            label="Enable Two-Factor Authentication"
            description="Require 2FA for added account security."
            value={twoFactor}
            onChange={setTwoFactor}
          />
          <HStack>
            <Button label="Save" variant="primary" />
          </HStack>
        </VStack>
      </Card>
    </VStack>
  );
}
