"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import { VStack, HStack } from "@astryxdesign/core/Layout";
import { Text, Heading } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { DateTimeInput, type ISODateTimeString } from "@astryxdesign/core/DateTimeInput";
import { Selector } from "@astryxdesign/core/Selector";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Badge } from "@astryxdesign/core/Badge";
import { Switch } from "@astryxdesign/core/Switch";
import { Banner } from "@astryxdesign/core/Banner";
import { useToast } from "@astryxdesign/core/Toast";
import {
  FormLayout,
  ScrollableArea,
  Step,
  Stepper,
  TextArea,
} from "@astryxdesign/core";
import AppLoading from "@/components/AppLoading";
import ConditionSentenceEditor from "@/components/ConditionSentenceEditor";
import { useRules, useCreateRule, useUpdateRule } from "@/lib/query";
import {
  EVENT_CATALOG,
  eventLabel,
  type EventType,
  type FormulaGroup,
  type RuleGroupType,
  type StructuredFormula,
} from "@/lib/rules";
import type { EarningRule, EarningRuleInput } from "@/types";
import type { Field } from "react-querybuilder";
import {
  renderFormulaGroupSentence,
  type AuthoringField,
} from "@/lib/ruleSentence";

const EVENT_TYPES = Object.keys(EVENT_CATALOG) as EventType[];

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

function authoringFields(
  eventType: EventType,
  perItem: boolean,
): AuthoringField[] {
  return getFieldsForEvent(eventType, perItem).map((f) => ({
    name: f.name,
    label: f.label,
    type: f.type === "number" ? "number" : "string",
  }));
}

function fieldLabels(
  eventType: EventType,
  perItem: boolean,
): Record<string, string> {
  return Object.fromEntries(
    authoringFields(eventType, perItem).map((f) => [f.name, f.label]),
  );
}

function defaultStructuredFormula(): StructuredFormula {
  return {
    type: "rate",
    basis: "orderAmount",
    rate: 1,
    flatAmount: 0,
    pointsPerUnit: 1,
    spendUnit: 100,
    rounding: "floor",
    minPoints: null,
    maxPoints: null,
  };
}

interface FormulaGroupState {
  uid: string;
  conditions: RuleGroupType;
  formulaType: "rate" | "flat" | "perAmount";
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
  activeFrom: string | null;
  activeUntil: string | null;
}

const MAX_STEPS = 3;

function defaultFormulaGroup(
  eventType: EventType = "purchase",
  uid: string,
): FormulaGroupState {
  const hasNumericFields = getNumericFields(eventType, false).length > 0;
  return {
    uid,
    conditions: { combinator: "and", rules: [] },
    formulaType: hasNumericFields ? "rate" : "flat",
    structured: hasNumericFields
      ? defaultStructuredFormula()
      : {
          type: "flat",
          basis: "",
          rate: 0,
          flatAmount: 1,
          pointsPerUnit: 0,
          spendUnit: 0,
          rounding: "floor",
          minPoints: null,
          maxPoints: null,
        },
  };
}

function defaultWizardState(): WizardState {
  return {
    name: "",
    description: "",
    eventType: "purchase",
    perItem: false,
    formulaGroups: [defaultFormulaGroup("purchase", makeUid())],
    pointsExpireAfterDays: null,
    active: true,
    activeFrom: null,
    activeUntil: null,
  };
}

function makeUid(): string {
  return `fg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isoToInput(
  iso: string | null | undefined,
): ISODateTimeString | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}` as ISODateTimeString;
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
            basis: "",
            rate: 0,
            rounding: "floor" as const,
            minPoints: null,
            maxPoints: null,
          }
        : g.formulaType === "perAmount"
          ? {
              ...g.structured,
              type: "perAmount" as const,
              rate: 0,
              pointsPerUnit: g.structured.pointsPerUnit ?? 1,
              spendUnit: g.structured.spendUnit ?? 100,
              rounding: "floor" as const,
              minPoints: null,
              maxPoints: null,
            }
          : {
              ...g.structured,
              type: "rate" as const,
              pointsPerUnit: 0,
              spendUnit: 0,
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
    activeFrom: s.activeFrom,
    activeUntil: s.activeUntil,
  };
}

function stateFromRule(r: {
  name: string;
  description: string | null;
  eventType: EventType;
  perItem: boolean;
  formulaGroups: FormulaGroup[];
  pointsExpireAfterDays: number | null;
  active: boolean;
  activeFrom: string | null;
  activeUntil: string | null;
}): WizardState {
  const fieldless = getNumericFields(r.eventType, r.perItem).length === 0;
  const groups: FormulaGroupState[] =
    r.formulaGroups && r.formulaGroups.length > 0
      ? r.formulaGroups.map((g) => ({
          uid: makeUid(),
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
      : [defaultFormulaGroup(r.eventType, makeUid())];
  return {
    name: r.name,
    description: r.description ?? "",
    eventType: r.eventType,
    perItem: r.perItem,
    formulaGroups: groups,
    pointsExpireAfterDays: r.pointsExpireAfterDays,
    active: r.active,
    activeFrom: r.activeFrom,
    activeUntil: r.activeUntil,
  };
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
  const allFields = authoringFields(eventType, perItem);
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

        <Card padding={4}>
          <VStack gap={1} hAlign="stretch">
            <Text type="label" weight="bold">
              What this group does
            </Text>
            <Text type="body">
              {renderFormulaGroupSentence(
                {
                  formulaType,
                  structured: group.structured,
                  conditions: group.conditions,
                },
                Object.fromEntries(allFields.map((f) => [f.name, f.label])),
              )}
            </Text>
          </VStack>
        </Card>

        {hasEventFields && (
          <VStack gap={2} hAlign="stretch">
            <Text type="label" weight="bold">
              Conditions
            </Text>
            <Text type="supporting" color="secondary">
              Leave empty to match all events. Add conditions to filter which
              events qualify for this group.
            </Text>
            <ConditionSentenceEditor
              conditions={group.conditions}
              onChange={(conditions: RuleGroupType) =>
                onChange(index, { ...group, conditions })
              }
              fields={allFields}
            />
          </VStack>
        )}

        <VStack gap={2} hAlign="stretch">
          <Text type="label" weight="bold">
            Formula
          </Text>
          <Card width={"fit-content"}>
            <FormLayout direction="horizontal">
              <Selector
                label="Formula type"
                isLabelHidden
                value={formulaType}
                options={[
                  ...(hasNumericFields
                    ? [
                        { value: "rate", label: "Rate (% of basis)" },
                        { value: "perAmount", label: "Points per spending" },
                      ]
                    : []),
                  { value: "flat", label: "Flat (fixed points)" },
                ]}
                onChange={(v: string) => {
                  const ft = v as "rate" | "flat" | "perAmount";
                  onChange(index, {
                    ...group,
                    formulaType: ft,
                    structured: {
                      ...group.structured,
                      type: ft,
                      ...(ft === "perAmount"
                        ? {
                            pointsPerUnit: group.structured.pointsPerUnit ?? 1,
                            spendUnit: group.structured.spendUnit ?? 100,
                          }
                        : {}),
                    },
                  });
                }}
              />
              {formulaType === "flat" && (
                <NumberInput
                  label="Points to award"
                  isLabelHidden
                  units={"pts"}
                  value={group.structured.flatAmount}
                  onChange={(v: number | null) =>
                    updateStructured({ flatAmount: v ?? 0 })
                  }
                  min={1}
                />
              )}

              {formulaType === "perAmount" && (
                <HStack gap={2}>
                  <HStack gap={3} align="center">
                    <Text type="body">Earn</Text>
                    <NumberInput
                      label="Points"
                      units={"pts"}
                      isLabelHidden
                      value={group.structured.pointsPerUnit}
                      onChange={(v: number | null) =>
                        updateStructured({ pointsPerUnit: v ?? 1 })
                      }
                      min={1}
                      size="sm"
                      width={90}
                    />
                  </HStack>
                  <HStack gap={3} align="center">
                    <Text type="body">for every</Text>
                    <NumberInput
                      label="Spending unit"
                      units="Rs"
                      isLabelHidden
                      value={group.structured.spendUnit}
                      onChange={(v: number | null) =>
                        updateStructured({ spendUnit: v ?? 100 })
                      }
                      min={1}
                      size="sm"
                      width={110}
                    />
                    <Text type="body">spent</Text>
                  </HStack>
                </HStack>
              )}

              {formulaType === "rate" && (
                <>
                  <Selector
                    label="Basis (what to take the percentage of)"
                    isLabelHidden
                    value={group.structured.basis}
                    options={numericFields.map((f) => ({
                      value: f.name,
                      label: f.label,
                    }))}
                    onChange={(v: string) => updateStructured({ basis: v })}
                  />
                  <NumberInput
                    label="Rate (%)"
                    isLabelHidden
                    units={"%"}
                    value={group.structured.rate}
                    onChange={(v: number | null) =>
                      updateStructured({ rate: v ?? 1 })
                    }
                    min={0.01}
                  />
                </>
              )}
            </FormLayout>
          </Card>
        </VStack>
      </VStack>
    </Card>
  );
}

export default function RuleFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const { data: rules = [], isLoading } = useRules();

  const editingRule =
    editId && rules.length > 0
      ? (rules.find((r) => r.id === editId) ?? null)
      : null;

  useEffect(() => {
    if (!isLoading && editId && !editingRule) {
      router.replace("/dashboard/rules");
    }
  }, [editId, editingRule, isLoading, router]);

  if (isLoading) {
    return <AppLoading label="Loading rule..." />;
  }

  return <RuleWizard key={editId ?? "new"} editingRule={editingRule} />;
}

function RuleWizard({ editingRule }: { editingRule: EarningRule | null }) {
  const router = useRouter();
  const showToast = useToast();

  const createMutation = useCreateRule();
  const updateMutation = useUpdateRule();

  const isEditing = Boolean(editingRule);

  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(() =>
    editingRule ? stateFromRule(editingRule) : defaultWizardState(),
  );
  const uidCounter = useRef(0);

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
      router.push("/dashboard/rules");
    } catch (err) {
      showToast({
        type: "error",
        body: err instanceof Error ? err.message : "Failed to save rule",
      });
    }
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
    uidCounter.current += 1;
    setState({
      ...state,
      formulaGroups: [
        ...state.formulaGroups,
        defaultFormulaGroup(
          state.eventType,
          `fg-${uidCounter.current}-${makeUid()}`,
        ),
      ],
    });
  };

  return (
    <VStack gap={6} hAlign="stretch">
      <HStack gap={3} vAlign="center">
        <Button
          label="Back to rules"
          variant="ghost"
          size="sm"
          icon={<ChevronLeft size="1em" />}
          onClick={() => router.push("/dashboard/rules")}
        />
        <VStack gap={0} hAlign="stretch" style={{ flex: 1 }}>
          <Heading level={2}>
            {isEditing ? "Edit earning rule" : "Create earning rule"}
          </Heading>
          <Text type="supporting" color="secondary">
            Highest-value matching group wins for each event.
          </Text>
        </VStack>
      </HStack>

      <Stepper
        activeStep={step}
        orientation="horizontal"
        onStepClick={setStep}
        horizontalOptions={{
          minimumStepWidth: 112,
          collapsedVariant: "withLabelAndControls",
        }}
      >
        <Step step={0} label="Basics" />
        <Step step={1} label="Formula Group" />
        <Step step={2} label="Review" />
      </Stepper>

      {step === 0 && (
        <FormLayout direction="vertical">
          <TextInput
            label="Rule name"
            placeholder="e.g. Beverage Bonus"
            value={state.name}
            onChange={(v: string) => setState({ ...state, name: v })}
            isRequired
          />
          <TextArea
            label="Description"
            placeholder="Short description (optional)"
            value={state.description}
            onChange={(v: string) => setState({ ...state, description: v })}
            isOptional
          />
          <FormLayout direction="horizontal">
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
                label="Evaluate once per line item"
                description="Off = once per order"
                value={state.perItem}
                changeAction={(v: boolean) =>
                  setState({ ...state, perItem: v })
                }
                style={{ alignSelf: "end" }}
              />
            )}
          </FormLayout>
        </FormLayout>
      )}

      {step === 1 && (
        <VStack gap={4} hAlign="stretch" style={{ marginTop: 20 }}>
          <Banner
            status="info"
            title="Add one or more formula groups. Each group has its own conditions
            and formula. The highest-value matching group wins."
          />

          {state.formulaGroups.map((g, i) => (
            <FormulaGroupCard
              key={g.uid}
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
        <VStack gap={4} hAlign="stretch">
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
          <VStack gap={2} hAlign="stretch">
            <Text type="label" weight="bold">
              Formula groups
            </Text>
            {state.formulaGroups.map((g, i) => (
              <HStack key={g.uid} gap={2} vAlign="center" wrap="wrap">
                <Badge variant="blue" label={`Group ${i + 1}`} />
                <Text type="body">
                  {renderFormulaGroupSentence(
                    {
                      formulaType: g.formulaType,
                      structured: g.structured,
                      conditions: g.conditions,
                    },
                    fieldLabels(state.eventType, state.perItem),
                  )}
                </Text>
              </HStack>
            ))}
          </VStack>
          <Banner
            status="info"
            title="When multiple groups match, the one with the highest point value wins."
            container="card"
          />
          <FormLayout>
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
          </FormLayout>
          <FormLayout>
            <DateTimeInput
              label="Active from"
              isOptional
              hasClear
              value={isoToInput(state.activeFrom)}
              onChange={(v: string | undefined) =>
                setState({ ...state, activeFrom: v ?? null })
              }
            />
            <DateTimeInput
              label="Active until"
              isOptional
              hasClear
              value={isoToInput(state.activeUntil)}
              onChange={(v: string | undefined) =>
                setState({ ...state, activeUntil: v ?? null })
              }
            />
          </FormLayout>
        </VStack>
      )}

      <HStack gap={3} style={{ marginTop: 16 }} hAlign="end">
        {step > 0 && (
          <Button
            label="Back"
            variant="secondary"
            onClick={() => setStep(step - 1)}
          />
        )}
        {step < MAX_STEPS - 1 ? (
          <Button
            label="Next"
            variant="primary"
            isDisabled={!state.name.trim()}
            onClick={() => {
              setStep(step + 1);
            }}
          />
        ) : (
          <Button
            label={isEditing ? "Save changes" : "Create rule"}
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
