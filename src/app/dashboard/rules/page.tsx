"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Plus, Trash2, ArrowLeft } from "lucide-react";
import { VStack, HStack, Stack } from "@astryxdesign/core/Layout";
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
  type FormulaGroup,
  type RuleGroupType,
  type StructuredFormula,
} from "@/lib/rules";
import type { EarningRule, EarningRuleInput } from "@/types";
import type {
  Field,
  RuleGroupType as RqbRuleGroupType,
} from "react-querybuilder";
import QueryBuilder from "react-querybuilder";
import { AppQueryBuilderElements } from "@/components/AppQueryBuilder";
import {
  CheckboxInput,
  FormLayout,
  proportional,
  Table,
} from "@astryxdesign/core";

const EVENT_TYPES = Object.keys(EVENT_CATALOG) as EventType[];
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
    visit: "teal",
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

function sanitizeConditions(
  conditions: RuleGroupType,
  eventType: EventType,
  perItem: boolean,
): RuleGroupType {
  const allowed = new Set(
    getFieldsForEvent(eventType, perItem).map((field) => field.name),
  );
  const rules: RuleGroupType["rules"] = [];
  for (const rule of conditions.rules) {
    if ("combinator" in rule) {
      const nested = sanitizeConditions(rule, eventType, perItem);
      if (nested.rules.length > 0) rules.push(nested);
    } else if (allowed.has(rule.field)) {
      rules.push(rule);
    }
  }
  return {
    combinator: conditions.combinator,
    rules,
  };
}

function getNumericFields(eventType: EventType, perItem: boolean): Field[] {
  // visit has no rate basis (no amount to take a % of); force flat formulas.
  if (eventType === "visit") return [];
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

function defaultStructuredFormula(): StructuredFormula {
  return {
    type: "rate",
    basis: "orderAmount",
    rate: 1,
    flatAmount: 0,
    rounding: "floor",
    minPoints: null,
    maxPoints: null,
  };
}

function defaultFormulaGroup(
  eventType: EventType = "purchase",
): FormulaGroupState {
  const hasNumericFields = getNumericFields(eventType, false).length > 0;
  return {
    conditions: { combinator: "and", rules: [] },
    formulaType: hasNumericFields ? "rate" : "flat",
    structured: hasNumericFields
      ? defaultStructuredFormula()
      : {
          type: "flat",
          basis: "",
          rate: 0,
          flatAmount: 1,
          rounding: "floor",
          minPoints: null,
          maxPoints: null,
        },
  };
}

interface FormulaGroupState {
  conditions: RuleGroupType;
  formulaType: "rate" | "flat";
  structured: StructuredFormula;
}

interface WizardState {
  name: string;
  description: string;
  eventType: EventType;
  perItem: boolean;
  formulaGroups: FormulaGroupState[];
  pointsExpireAfterDays: number | null;
  active: boolean;
}

function defaultWizardState(): WizardState {
  return {
    name: "",
    description: "",
    eventType: "purchase",
    perItem: false,
    formulaGroups: [defaultFormulaGroup()],
    pointsExpireAfterDays: null,
    active: true,
  };
}

function stateToInput(s: WizardState): EarningRuleInput {
  const fieldless = getNumericFields(s.eventType, s.perItem).length === 0;
  const groups: FormulaGroup[] = s.formulaGroups.map((g) => ({
    conditions: sanitizeConditions(g.conditions, s.eventType, s.perItem),
    formula:
      fieldless || g.formulaType === "flat"
        ? {
            ...g.structured,
            type: "flat" as const,
            rate: 0,
            rounding: "floor" as const,
            minPoints: null,
            maxPoints: null,
          }
        : {
            ...g.structured,
            type: "rate" as const,
            rounding: "floor" as const,
            minPoints: null,
            maxPoints: null,
          },
  }));
  return {
    name: s.name,
    description: s.description || null,
    eventType: s.eventType,
    perItem: s.perItem,
    formulaGroups: groups,
    pointsExpireAfterDays: s.pointsExpireAfterDays,
    active: s.active,
  };
}

function stateFromRule(r: EarningRule): WizardState {
  const fieldless = getNumericFields(r.eventType, r.perItem).length === 0;
  const groups: FormulaGroupState[] =
    r.formulaGroups && r.formulaGroups.length > 0
      ? r.formulaGroups.map((g) => ({
          conditions: sanitizeConditions(g.conditions, r.eventType, r.perItem),
          formulaType: fieldless ? "flat" : g.formula.type,
          structured: fieldless
            ? {
                ...g.formula,
                type: "flat",
                basis: "",
                rate: 0,
                flatAmount: g.formula.flatAmount || 1,
              }
            : g.formula,
        }))
      : [defaultFormulaGroup(r.eventType)];
  return {
    name: r.name,
    description: r.description ?? "",
    eventType: r.eventType,
    perItem: r.perItem,
    formulaGroups: groups,
    pointsExpireAfterDays: r.pointsExpireAfterDays,
    active: r.active,
  };
}

function groupSummaryText(g: FormulaGroupState): string {
  if (g.formulaType === "flat") {
    return `${g.structured.flatAmount} pts (flat)`;
  }
  return `${g.structured.rate}% of ${g.structured.basis || "?"}`;
}

function FormulaGroupCard({
  group,
  index,
  total,
  eventType,
  perItem,
  onChange,
  onRemove,
  canRemove,
}: {
  group: FormulaGroupState;
  index: number;
  total: number;
  eventType: EventType;
  perItem: boolean;
  onChange: (index: number, updated: FormulaGroupState) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}) {
  const numericFields = getNumericFields(eventType, perItem);
  const allFields = getFieldsForEvent(eventType, perItem);
  const hasNumericFields = numericFields.length > 0;
  const hasEventFields = hasFields(eventType);
  const formulaType = hasNumericFields ? group.formulaType : "flat";

  const updateStructured = (patch: Partial<StructuredFormula>) => {
    onChange(index, {
      ...group,
      structured: { ...group.structured, ...patch },
    });
  };

  return (
    <Card padding={6}>
      <VStack gap={4} hAlign="stretch">
        <HStack gap={3} vAlign="center">
          <Heading level={4}>Formula group {index + 1}</Heading>
          {canRemove && (
            <Button
              label="Remove"
              variant="ghost"
              size="sm"
              icon={<Trash2 size="1em" />}
              onClick={() => onRemove(index)}
            />
          )}
        </HStack>

        {hasEventFields && (
          <VStack gap={2} hAlign="stretch">
            <Text type="label" weight="bold">
              Conditions
            </Text>
            <Text type="supporting" color="secondary">
              Leave empty to match all events. Add conditions to filter which
              events qualify for this group.
            </Text>
            <QueryBuilder
              fields={allFields}
              query={group.conditions as RqbRuleGroupType}
              onQueryChange={(q: RqbRuleGroupType) =>
                onChange(index, {
                  ...group,
                  conditions: q as unknown as RuleGroupType,
                })
              }
              addRuleToNewGroups
              operators={SUPPORTED_OPERATORS}
              controlElements={AppQueryBuilderElements}
            />
          </VStack>
        )}

        <Text type="label" weight="bold">
          Formula
        </Text>
        <FormLayout direction="horizontal">
          <Selector
            label="Formula type"
            value={formulaType}
            options={[
              ...(hasNumericFields
                ? [{ value: "rate", label: "Rate (% of basis)" }]
                : []),
              { value: "flat", label: "Flat (fixed points)" },
            ]}
            onChange={(v: string) => {
              const ft = v as "rate" | "flat";
              onChange(index, {
                ...group,
                formulaType: ft,
                structured: {
                  ...group.structured,
                  type: ft,
                },
              });
            }}
          />

          {formulaType === "rate" && (
            <FormLayout direction="horizontal">
              <Selector
                label="Basis (what to take the percentage of)"
                value={group.structured.basis}
                options={numericFields.map((f) => ({
                  value: f.name,
                  label: f.label,
                }))}
                onChange={(v: string) => updateStructured({ basis: v })}
              />
              <NumberInput
                label="Rate (%)"
                value={group.structured.rate}
                onChange={(v: number | null) =>
                  updateStructured({ rate: v ?? 1 })
                }
                min={0.01}
              />
            </FormLayout>
          )}

          {formulaType === "flat" && (
            <VStack gap={3} hAlign="stretch">
              <NumberInput
                label="Points to award"
                value={group.structured.flatAmount}
                onChange={(v: number | null) =>
                  updateStructured({ flatAmount: v ?? 0 })
                }
                min={1}
              />
            </VStack>
          )}
        </FormLayout>
      </VStack>
    </Card>
  );
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

  const maxSteps = 3;
  const stepLabels = ["Basics", "Formula Groups", "Review"];

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
    for (let i = 0; i < state.formulaGroups.length; i++) {
      const g = state.formulaGroups[i];
      if (g.formulaType === "flat" && g.structured.flatAmount <= 0) {
        showToast({
          type: "error",
          body: `Formula group ${i + 1}: flat amount must be greater than 0`,
        });
        return;
      }
      if (g.formulaType === "rate" && !g.structured.basis) {
        showToast({
          type: "error",
          body: `Formula group ${i + 1}: basis is required for rate formulas`,
        });
        return;
      }
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

  const updateGroup = (index: number, updated: FormulaGroupState) => {
    const groups = [...state.formulaGroups];
    groups[index] = updated;
    setState({ ...state, formulaGroups: groups });
  };

  const removeGroup = (index: number) => {
    const groups = state.formulaGroups.filter((_, i) => i !== index);
    setState({ ...state, formulaGroups: groups });
  };

  const addGroup = () => {
    setState({
      ...state,
      formulaGroups: [
        ...state.formulaGroups,
        defaultFormulaGroup(state.eventType),
      ],
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
                  const eventType = v as EventType;
                  const fieldless =
                    getNumericFields(eventType, false).length === 0;
                  setState({
                    ...state,
                    eventType,
                    perItem: eventType === "purchase" ? state.perItem : false,
                    formulaGroups: state.formulaGroups.map((group) => ({
                      ...group,
                      conditions: sanitizeConditions(
                        group.conditions,
                        eventType,
                        eventType === "purchase" ? state.perItem : false,
                      ),
                    })),
                    ...(fieldless
                      ? {
                          formulaGroups: state.formulaGroups.map((group) => ({
                            ...group,
                            conditions: sanitizeConditions(
                              group.conditions,
                              eventType,
                              false,
                            ),
                            formulaType: "flat" as const,
                            structured: {
                              ...group.structured,
                              type: "flat" as const,
                              basis: "",
                              rate: 0,
                              flatAmount: group.structured.flatAmount || 1,
                            },
                          })),
                        }
                      : {}),
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

        {step === 1 && (
          <VStack gap={4} hAlign="stretch">
            <Text type="supporting" color="secondary">
              Add one or more formula groups. Each group has its own conditions
              and formula. The highest-value matching group wins.
            </Text>
            {state.formulaGroups.map((g, i) => (
              <FormulaGroupCard
                key={i}
                group={g}
                index={i}
                total={state.formulaGroups.length}
                eventType={state.eventType}
                perItem={state.perItem}
                onChange={updateGroup}
                onRemove={removeGroup}
                canRemove={state.formulaGroups.length > 1}
              />
            ))}
            <Button
              label="Add formula group"
              variant="secondary"
              icon={<Plus size="1em" />}
              onClick={addGroup}
            />
          </VStack>
        )}

        {step === 2 && (
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
              <Text type="body">Per item: {state.perItem ? "Yes" : "No"}</Text>
              <VStack gap={2} hAlign="stretch">
                <Text type="label" weight="bold">
                  Formula groups ({state.formulaGroups.length})
                </Text>
                {state.formulaGroups.map((g, i) => (
                  <HStack key={i} gap={2} vAlign="center">
                    <Badge variant="blue" label={`Group ${i + 1}`} />
                    <Text type="body">
                      {groupSummaryText(g)}
                      {isRuleGroupEmpty(g.conditions)
                        ? " · All events"
                        : " · Custom conditions"}
                    </Text>
                  </HStack>
                ))}
              </VStack>
              <Banner
                status="info"
                title="When multiple groups match, the one with the highest point value wins."
                container="card"
              />
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
        title="Rules are evaluated in order. The highest-value matching rule wins for each event."
        container="card"
      />

      <Table
        data={rules}
        emptyState={
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
        }
        columns={[
          {
            key: "name",
            header: "Name",
            renderCell: (item) => (
              <Link
                href={`/dashboard/rules/${item.id}`}
                className="text-accent font-medium hover:underline"
              >
                {item.name}
              </Link>
            ),
          },
          {
            key: "description",
            header: "Description",
            width: proportional(2),
          },
          {
            key: "pointsExpireAfterDays",
            header: "Points expire after days",
            renderCell: (item) => (
              <Text type="supporting" color="secondary">
                {item.formulaText} · Expiry:{" "}
                {item.pointsExpireAfterDays
                  ? `${item.pointsExpireAfterDays}d`
                  : "never"}
              </Text>
            ),
          },
          {
            key: "active",
            header: "Active",
            renderCell: (item) => (
              <Switch
                label=""
                value={item.active}
                onChange={(v) =>
                  toggleMutation.mutate({ id: item.id, active: v })
                }
              />
            ),
          },
          {
            key: "actions",
            header: "Actions",
            align: "start",
            renderCell: (item) => (
              <Stack direction="horizontal" gap={2} hAlign="start">
                <Button
                  label="Edit"
                  variant="primary"
                  size="sm"
                  onClick={() => startEdit(item)}
                />
                <Button
                  label="Delete"
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(item)}
                />
              </Stack>
            ),
          },
        ]}
      />

      {alert.element}
    </VStack>
  );
}
