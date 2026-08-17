"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, Plus, Trash2, ArrowLeft } from "lucide-react";
import { VStack, HStack } from "@astryxdesign/core/Layout";
import { Text, Heading } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { Selector } from "@astryxdesign/core/Selector";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Icon } from "@astryxdesign/core/Icon";
import { Badge } from "@astryxdesign/core/Badge";
import { Switch } from "@astryxdesign/core/Switch";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Banner } from "@astryxdesign/core/Banner";
import { useToast } from "@astryxdesign/core/Toast";
import { useImperativeAlertDialog } from "@astryxdesign/core/AlertDialog";
import AppLoading from "@/components/AppLoading";
import AppHeader from "@/components/AppHeader";
import {
  useRules,
  useCreateRule,
  useUpdateRule,
  useDeleteRule,
  useToggleRule,
} from "@/lib/query";
import {
  EVENT_CATALOG,
  eventLabel,
  type EventType,
  type RuleGroupType,
} from "@/lib/rules";
import type { EarningRule, EarningRuleInput } from "@/types";
import type {
  Field,
  RuleGroupType as RqbRuleGroupType,
} from "react-querybuilder";
import QueryBuilder from "react-querybuilder";
import { AppQueryBuilderElements } from "@/components/AppQueryBuilder";

const EVENT_TYPES = Object.keys(EVENT_CATALOG) as EventType[];
const ROUNDING_OPTIONS = [
  { value: "floor", label: "Floor (round down)" },
  { value: "ceil", label: "Ceil (round up)" },
  { value: "round", label: "Round (nearest)" },
];

const SUPPORTED_OPERATORS = [
  { name: "=", label: "=" },
  { name: "!=", label: "!=" },
  { name: ">", label: ">" },
  { name: ">=", label: ">=" },
  { name: "<", label: "<" },
  { name: "<=", label: "<=" },
  { name: "contains", label: "contains" },
  { name: "in", label: "in" },
  { name: "between", label: "between" },
  { name: "notBetween", label: "not between" },
  { name: "isSet", label: "is set" },
];

function eventTypeBadgeColor(
  t: string,
): "blue" | "green" | "yellow" | "purple" | "teal" | "orange" {
  const m: Record<
    string,
    "blue" | "green" | "yellow" | "purple" | "teal" | "orange"
  > = {
    purchase: "blue",
    review: "purple",
    referral: "teal",
    newsletter_signup: "yellow",
    social_share: "orange",
    customer_signup: "green",
  };
  return m[t] || "blue";
}

function getFieldsForEvent(eventType: EventType, perItem: boolean): Field[] {
  const catalog = EVENT_CATALOG[eventType];
  return Object.entries(catalog.fields)
    .filter(([, def]) => {
      const name = def.description;
      const isPerItemField =
        name.includes("per-item") || name.includes("line item");
      return perItem || !isPerItemField;
    })
    .map(([key, def]) => ({
      name: key,
      label: def.description,
      type: def.type === "number" ? "number" : ("text" as const),
    }));
}

function getNumericFields(eventType: EventType, perItem: boolean): Field[] {
  return getFieldsForEvent(eventType, perItem).filter(
    (f) => f.type === "number",
  );
}

function hasFields(eventType: EventType): boolean {
  const fields = EVENT_CATALOG[eventType].fields;
  return Object.keys(fields).length > 0;
}

function isRuleGroupEmpty(conditions: RuleGroupType): boolean {
  return conditions.rules.length === 0;
}

interface WizardState {
  name: string;
  description: string;
  eventType: EventType;
  perItem: boolean;
  conditions: RuleGroupType;
  formulaType: "rate" | "flat";
  structured: {
    basis: string;
    rate: number;
    flatAmount: number;
    rounding: string;
    minPoints: number | null;
    maxPoints: number | null;
  };
  pointsExpireAfterDays: number | null;
  active: boolean;
}

function defaultWizardState(): WizardState {
  return {
    name: "",
    description: "",
    eventType: "purchase",
    perItem: false,
    conditions: { combinator: "and", rules: [] },
    formulaType: "rate",
    structured: {
      basis: "orderAmount",
      rate: 1,
      flatAmount: 0,
      rounding: "floor",
      minPoints: null,
      maxPoints: null,
    },
    pointsExpireAfterDays: null,
    active: true,
  };
}

function stateToInput(s: WizardState): EarningRuleInput {
  const isFlat = s.formulaType === "flat";
  return {
    name: s.name,
    description: s.description || null,
    eventType: s.eventType,
    perItem: s.perItem,
    conditions: isRuleGroupEmpty(s.conditions) ? undefined : s.conditions,
    structured: {
      type: s.formulaType,
      basis: isFlat ? "" : s.structured.basis || "orderAmount",
      rate: s.formulaType === "rate" ? s.structured.rate : 0,
      flatAmount: isFlat ? s.structured.flatAmount : 0,
      rounding: s.structured.rounding as "floor" | "ceil" | "round",
      minPoints: s.structured.minPoints,
      maxPoints: s.structured.maxPoints,
    } as never,
    pointsExpireAfterDays: s.pointsExpireAfterDays,
    active: s.active,
  };
}

function stateFromRule(r: EarningRule): WizardState {
  const isFlat = (r.formulaType ?? "rate") === "flat";
  return {
    name: r.name,
    description: r.description ?? "",
    eventType: r.eventType,
    perItem: r.perItem,
    conditions: r.conditions ?? { combinator: "and", rules: [] },
    formulaType: isFlat ? "flat" : "rate",
    structured: {
      basis: r.formulaBasis ?? "orderAmount",
      rate: Number(r.formulaRate) || 1,
      flatAmount: r.formulaFlatAmount ?? 0,
      rounding: r.formulaRounding ?? "floor",
      minPoints: r.formulaMinPoints,
      maxPoints: r.formulaMaxPoints,
    },
    pointsExpireAfterDays: r.pointsExpireAfterDays,
    active: r.active,
  };
}

export default function RulesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const showToast = useToast();
  const alert = useImperativeAlertDialog();

  const { data: rules = [], isLoading } = useRules();
  const createMutation = useCreateRule();
  const updateMutation = useUpdateRule();
  const deleteMutation = useDeleteRule();
  const toggleMutation = useToggleRule();

  const editingRule = useMemo(
    () => (editId ? (rules.find((r) => r.id === editId) ?? null) : null),
    [editId, rules],
  );

  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(defaultWizardState);

  const numericFields = getNumericFields(state.eventType, state.perItem);
  const hasNumericFields = numericFields.length > 0;
  const skipConditions = !hasFields(state.eventType);

  const maxSteps = skipConditions ? 3 : 4;
  const stepLabels = skipConditions
    ? ["Basics", "Formula", "Review"]
    : ["Basics", "Conditions", "Formula", "Review"];

  const openWizard = (prefill?: WizardState) => {
    setState(prefill ?? defaultWizardState());
    setStep(0);
    setShowWizard(true);
  };

  const startEdit = (rule: EarningRule) => {
    openWizard(stateFromRule(rule));
  };

  if (editId && !showWizard) {
    if (isLoading) return <AppLoading label="Loading rule..." />;
    if (editingRule) {
      openWizard(stateFromRule(editingRule));
    } else {
      router.replace("/dashboard/rules");
    }
  }

  const handleSave = async () => {
    if (!state.name.trim()) {
      showToast({ type: "error", body: "Rule name is required" });
      return;
    }
    if (state.formulaType === "flat" && state.structured.flatAmount <= 0) {
      showToast({ type: "error", body: "Flat amount must be greater than 0" });
      return;
    }
    if (state.formulaType === "rate" && !state.structured.basis) {
      showToast({ type: "error", body: "Basis is required for rate formulas" });
      return;
    }
    try {
      const input = stateToInput(state);
      if (editingRule) {
        await updateMutation.mutateAsync({ id: editingRule.id, input });
        showToast({ type: "info", body: "Rule updated" });
      } else {
        await createMutation.mutateAsync(input);
        showToast({ type: "info", body: "Rule created" });
      }
      setShowWizard(false);
      router.replace("/dashboard/rules");
    } catch (err) {
      showToast({
        type: "error",
        body: err instanceof Error ? err.message : "Failed to save rule",
      });
    }
  };

  const handleDelete = (rule: EarningRule) => {
    alert.show({
      title: "Delete rule?",
      description: `This will permanently delete "${rule.name}". Points already earned are not affected.`,
      actionLabel: "Delete",
      onAction: async () => {
        try {
          await deleteMutation.mutateAsync(rule.id);
          showToast({ type: "info", body: "Rule deleted" });
          alert.hide();
        } catch {
          showToast({ type: "error", body: "Failed to delete rule" });
        }
      },
    });
  };

  if (isLoading) {
    return <AppLoading label="Loading rules..." />;
  }

  if (showWizard) {
    return (
      <VStack gap={6} hAlign="stretch">
        <HStack gap={3} vAlign="center">
          <Button
            label="Back"
            variant="ghost"
            size="sm"
            icon={<ArrowLeft size="1em" />}
            onClick={() => {
              setShowWizard(false);
              router.replace("/dashboard/rules");
            }}
          />
          <VStack gap={0} hAlign="stretch">
            <Heading level={2}>
              {editingRule ? "Edit rule" : "New rule"}
            </Heading>
            <Text type="supporting" color="secondary">
              Step {step + 1} of {maxSteps}: {stepLabels[step]}
            </Text>
          </VStack>
        </HStack>

        {step === 0 && (
          <Card padding={6}>
            <VStack gap={4} hAlign="stretch">
              <Heading level={3}>Basics</Heading>
              <TextInput
                label="Rule name"
                placeholder="e.g. Beverage Bonus"
                value={state.name}
                onChange={(v: string) => setState({ ...state, name: v })}
                isRequired
              />
              <TextInput
                label="Description"
                placeholder="Short description (optional)"
                value={state.description}
                onChange={(v: string) => setState({ ...state, description: v })}
                isOptional
              />
              <Selector
                label="Event type"
                value={state.eventType}
                options={EVENT_TYPES.map((t) => ({
                  value: t,
                  label: eventLabel(t),
                }))}
                onChange={(v: string) => {
                  const newEventType = v as EventType;
                  const newHasNumericFields =
                    getNumericFields(newEventType, state.perItem).length > 0;
                  setState({
                    ...state,
                    eventType: newEventType,
                    formulaType: newHasNumericFields ? "rate" : "flat",
                  });
                }}
              />
              {state.eventType === "purchase" && (
                <Switch
                  label="Per line item (evaluate once per product, not once per order)"
                  value={state.perItem}
                  changeAction={(v: boolean) =>
                    setState({ ...state, perItem: v })
                  }
                />
              )}
            </VStack>
          </Card>
        )}

        {step === 1 && !skipConditions && (
          <Card padding={6}>
            <VStack gap={4} hAlign="stretch">
              <Heading level={3}>Conditions</Heading>
              <Text type="supporting" color="secondary">
                Leave empty to match all events. Add conditions to filter which
                events qualify for this rule.
              </Text>
              <QueryBuilder
                fields={getFieldsForEvent(state.eventType, state.perItem)}
                query={state.conditions as RqbRuleGroupType}
                onQueryChange={(q: RqbRuleGroupType) =>
                  setState({
                    ...state,
                    conditions: q as unknown as RuleGroupType,
                  })
                }
                addRuleToNewGroups
                operators={SUPPORTED_OPERATORS}
                controlElements={AppQueryBuilderElements}
              />
            </VStack>
          </Card>
        )}

        {step === (skipConditions ? 1 : 2) && (
          <Card padding={6}>
            <VStack gap={4} hAlign="stretch">
              <Heading level={3}>Formula</Heading>
              <Text type="supporting" color="secondary">
                Define how points are calculated.
              </Text>

              <Selector
                label="Formula type"
                value={state.formulaType}
                options={[
                  { value: "rate", label: "Rate (% of basis)" },
                  ...(hasNumericFields
                    ? [{ value: "flat", label: "Flat (fixed points)" }]
                    : []),
                ]}
                onChange={(v: string) =>
                  setState({ ...state, formulaType: v as "rate" | "flat" })
                }
              />

              {state.formulaType === "rate" && (
                <VStack gap={3} hAlign="stretch">
                  <Selector
                    label="Basis (what to take the percentage of)"
                    value={state.structured.basis}
                    options={numericFields.map((f) => ({
                      value: f.name,
                      label: f.label,
                    }))}
                    onChange={(v: string) =>
                      setState({
                        ...state,
                        structured: { ...state.structured, basis: v },
                      })
                    }
                  />
                  <NumberInput
                    label="Rate (%)"
                    value={state.structured.rate}
                    onChange={(v: number | null) =>
                      setState({
                        ...state,
                        structured: { ...state.structured, rate: v ?? 1 },
                      })
                    }
                    min={0.01}
                  />
                  <Text type="supporting" color="secondary">
                    e.g. {state.structured.rate}% of{" "}
                    {state.structured.basis || "basis"} becomes points
                  </Text>
                </VStack>
              )}

              {state.formulaType === "flat" && (
                <VStack gap={3} hAlign="stretch">
                  <NumberInput
                    label="Points to award"
                    value={state.structured.flatAmount}
                    onChange={(v: number | null) =>
                      setState({
                        ...state,
                        structured: { ...state.structured, flatAmount: v ?? 0 },
                      })
                    }
                    min={1}
                  />
                  <Text type="supporting" color="secondary">
                    Fixed points awarded when this rule matches (e.g. 50 points
                    for signup)
                  </Text>
                </VStack>
              )}

              <Selector
                label="Rounding"
                value={state.structured.rounding}
                options={ROUNDING_OPTIONS}
                onChange={(v: string) =>
                  setState({
                    ...state,
                    structured: { ...state.structured, rounding: v },
                  })
                }
              />
              <HStack gap={3}>
                <NumberInput
                  label="Min points (floor)"
                  value={state.structured.minPoints}
                  onChange={(v: number | null) =>
                    setState({
                      ...state,
                      structured: { ...state.structured, minPoints: v },
                    })
                  }
                  isOptional
                />
                <NumberInput
                  label="Max points (cap)"
                  value={state.structured.maxPoints}
                  onChange={(v: number | null) =>
                    setState({
                      ...state,
                      structured: { ...state.structured, maxPoints: v },
                    })
                  }
                  isOptional
                />
              </HStack>
            </VStack>
          </Card>
        )}

        {step === maxSteps - 1 && (
          <Card padding={6}>
            <VStack gap={4} hAlign="stretch">
              <Heading level={3}>Review &amp; save</Heading>
              <HStack gap={3} vAlign="center">
                <Badge
                  variant={eventTypeBadgeColor(state.eventType)}
                  label={eventLabel(state.eventType)}
                />
                <Text type="body" weight="bold">
                  {state.name || "(unnamed)"}
                </Text>
              </HStack>
              {state.description && (
                <Text type="supporting" color="secondary">
                  {state.description}
                </Text>
              )}
              <Text type="body">
                Per item: {state.perItem ? "Yes" : "No"} · Formula:{" "}
                {state.formulaType === "flat"
                  ? `${state.structured.flatAmount} pts (flat)`
                  : `${state.structured.rate}% of ${state.structured.basis}`}
              </Text>
              <Text type="body">
                Conditions:{" "}
                {isRuleGroupEmpty(state.conditions)
                  ? "None (all events)"
                  : "Custom conditions"}
              </Text>
              <NumberInput
                label="Points expire after (days, blank = never)"
                value={state.pointsExpireAfterDays}
                onChange={(v: number | null) =>
                  setState({ ...state, pointsExpireAfterDays: v })
                }
                min={1}
                isOptional
              />
              <Switch
                label="Active"
                value={state.active}
                changeAction={(v: boolean) => setState({ ...state, active: v })}
              />
            </VStack>
          </Card>
        )}

        <HStack gap={3}>
          {step > 0 && (
            <Button
              label="Back"
              variant="secondary"
              onClick={() => setStep(step - 1)}
            />
          )}
          {step < maxSteps - 1 ? (
            <Button
              label="Next"
              variant="primary"
              onClick={() => setStep(step + 1)}
            />
          ) : (
            <Button
              label={editingRule ? "Save changes" : "Create rule"}
              variant="primary"
              isLoading={createMutation.isPending || updateMutation.isPending}
              isDisabled={!state.name.trim()}
              onClick={handleSave}
            />
          )}
        </HStack>
      </VStack>
    );
  }

  return (
    <VStack gap={6} hAlign="stretch">
      <AppHeader
        heading="Rules"
        description="Create and manage earning rules for your loyalty program"
        showButton={true}
        onClick={() => openWizard()}
        showSearch={false}
        showFilter={false}
      />

      <Banner
        status="info"
        title="Rules are evaluated in order. Multiple matching rules stack — all matching rules award points on the same event."
        container="card"
      />

      {rules.length === 0 ? (
        <Card padding={8}>
          <EmptyState
            title="No rules yet"
            description="Create your first earning rule to start awarding points automatically."
            icon={<Icon icon={ShieldCheck} size="lg" />}
            actions={
              <Button
                label="Create rule"
                variant="primary"
                onClick={() => openWizard()}
              />
            }
          />
        </Card>
      ) : (
        <VStack gap={3} hAlign="stretch">
          {rules.map((rule) => (
            <Card key={rule.id} padding={5}>
              <HStack gap={4} hAlign="between" vAlign="center">
                <VStack gap={1} hAlign="stretch">
                  <HStack gap={2} vAlign="center">
                    <Badge
                      variant={eventTypeBadgeColor(rule.eventType)}
                      label={eventLabel(rule.eventType)}
                    />
                    <Text type="body" weight="bold">
                      {rule.name}
                    </Text>
                    {rule.perItem && (
                      <Badge variant="neutral" label="per item" />
                    )}
                  </HStack>
                  {rule.description && (
                    <Text type="supporting" color="secondary" maxLines={1}>
                      {rule.description}
                    </Text>
                  )}
                  <Text type="supporting" color="secondary">
                    {rule.formulaText} · Expiry:{" "}
                    {rule.pointsExpireAfterDays
                      ? `${rule.pointsExpireAfterDays}d`
                      : "never"}
                  </Text>
                </VStack>
                <HStack gap={2} vAlign="center">
                  <Switch
                    label={`${rule.name} active`}
                    isLabelHidden
                    value={rule.active}
                    changeAction={async (checked: boolean) => {
                      try {
                        await toggleMutation.mutateAsync({
                          id: rule.id,
                          active: checked,
                        });
                      } catch {
                        showToast({
                          type: "error",
                          body: "Failed to update status",
                        });
                      }
                    }}
                  />
                  <Button
                    label="Edit"
                    variant="ghost"
                    size="sm"
                    onClick={() => startEdit(rule)}
                  />
                  <Button
                    label="Delete"
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 size="1em" />}
                    onClick={() => handleDelete(rule)}
                  />
                </HStack>
              </HStack>
            </Card>
          ))}
        </VStack>
      )}
      {alert.element}
    </VStack>
  );
}
