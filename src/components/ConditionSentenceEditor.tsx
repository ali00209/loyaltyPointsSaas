"use client";

import { useMemo } from "react";
import { Card, HStack, VStack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { Banner } from "@astryxdesign/core/Banner";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import type { RuleGroupType, RuleType } from "react-querybuilder";
import {
  SENTENCE_OPERATORS,
  operatorsForField,
  renderConditionsSentence,
  simplifyConditions,
  isLegacyConditions,
  type AuthoringField,
  type AuthoredOperator,
} from "@/lib/ruleSentence";
import { FormLayout } from "@astryxdesign/core";

function newRule(field: AuthoringField): RuleType {
  const op: AuthoredOperator = field.type === "string" ? "=" : ">";
  return {
    id:
      globalThis.crypto?.randomUUID?.() ??
      `r-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`,
    field: field.name,
    operator: op,
    value: field.type === "string" ? "" : 0,
  };
}

export default function ConditionSentenceEditor({
  conditions,
  onChange,
  fields,
}: {
  conditions: RuleGroupType;
  onChange: (conditions: RuleGroupType) => void;
  fields: AuthoringField[];
}) {
  const byName = useMemo(
    () => Object.fromEntries(fields.map((f) => [f.name, f])),
    [fields],
  );
  const labels = useMemo(
    () => Object.fromEntries(fields.map((f) => [f.name, f.label])),
    [fields],
  );

  const legacy = isLegacyConditions(conditions);
  const sentence = renderConditionsSentence(conditions, labels);

  const updateRule = (index: number, patch: Partial<RuleType>) => {
    const rules = conditions.rules.map((r, i) =>
      i === index && !("combinator" in r)
        ? ({ ...(r as RuleType), ...patch } as RuleType)
        : r,
    );
    onChange({ ...conditions, rules });
  };

  const removeRule = (index: number) => {
    onChange({
      ...conditions,
      rules: conditions.rules.filter((_, i) => i !== index),
    });
  };

  const addRule = () => {
    onChange({
      ...conditions,
      rules: [...conditions.rules, newRule(fields[0])],
    });
  };

  if (fields.length === 0) return null;

  if (legacy) {
    return (
      <VStack gap={3} hAlign="stretch">
        <Banner
          status="warning"
          title="This group uses advanced conditions that can't be edited here yet."
          description={`${sentence || "It matches all events."} You can simplify it into the sentence form below.`}
          endContent={
            <Button
              label="Simplify"
              variant="secondary"
              size="sm"
              icon={<Sparkles size="1em" />}
              onClick={() => onChange(simplifyConditions(conditions))}
            />
          }
        />
        <Text type="body" color="secondary">
          {sentence || "All events qualify."}
        </Text>
      </VStack>
    );
  }

  return (
    <VStack gap={3} hAlign="stretch">
      <HStack>
        <Card width={"fit-content"}>
          {conditions.rules.length > 1 && (
            <DropdownMenu
              button={{
                label:
                  conditions.combinator === "and" ? "match all" : "match any",
                variant: "ghost",
                size: "sm",
              }}
              items={[
                {
                  label: "match all",
                  onClick: () => onChange({ ...conditions, combinator: "and" }),
                },
                {
                  label: "match any",
                  onClick: () => onChange({ ...conditions, combinator: "or" }),
                },
              ]}
            />
          )}
          <Button
            label="Add condition"
            variant="ghost"
            size="sm"
            icon={<Plus size="1em" />}
            onClick={addRule}
          />
        </Card>
      </HStack>

      <HStack gap={2} wrap="wrap" vAlign="center">
        {conditions.rules.map((rule, i) => {
          if ("combinator" in rule) return null;
          const r = rule as RuleType;
          const field = byName[r.field] ?? fields[0];
          const ops = operatorsForField(field);
          const operator = (
            SENTENCE_OPERATORS[r.operator as AuthoredOperator]
              ? r.operator
              : ops[0]
          ) as AuthoredOperator;
          const numeric = field.type === "number";
          const isBetween = operator === "between" || operator === "notBetween";
          const [loRaw, hiRaw] = isBetween
            ? String(r.value ?? "")
                .split(",")
                .map((s) => s.trim())
            : [];
          const toNum = (s: string | undefined) =>
            s !== undefined && s !== "" ? Number(s) || null : null;
          const numericValue =
            typeof r.value === "number"
              ? r.value
              : r.value === null || r.value === undefined || r.value === ""
                ? null
                : Number(r.value) || 0;

          return (
            <Card key={r.id ?? i} width={"fit-content"}>
              <FormLayout direction="horizontal">
                <DropdownMenu
                  button={{
                    label: field.label,
                    variant: "ghost",
                    size: "sm",
                  }}
                  items={fields.map((f) => {
                    const newOps = operatorsForField(f);
                    const keepOperator = (
                      SENTENCE_OPERATORS[r.operator as AuthoredOperator]
                        ? r.operator
                        : ""
                    ) as AuthoredOperator | "";
                    const operator = newOps.includes(
                      keepOperator as AuthoredOperator,
                    )
                      ? keepOperator
                      : newOps[0];
                    return {
                      label: f.label,
                      onClick: () =>
                        updateRule(i, {
                          field: f.name,
                          operator,
                          value: f.type === "string" ? "" : 0,
                        }),
                    };
                  })}
                />

                <DropdownMenu
                  button={{
                    label: SENTENCE_OPERATORS[operator].phrase,
                    variant: "ghost",
                    size: "sm",
                  }}
                  items={ops.map((op) => ({
                    label: SENTENCE_OPERATORS[op].phrase,
                    onClick: () => {
                      const nextBetween =
                        op === "between" || op === "notBetween";
                      updateRule(i, {
                        operator: op,
                        value:
                          nextBetween && !isBetween
                            ? "0,100"
                            : !nextBetween && isBetween
                              ? numericValue
                              : r.value,
                      });
                    },
                  }))}
                />

                {isBetween ? (
                  <FormLayout direction="horizontal">
                    <NumberInput
                      label=""
                      isLabelHidden
                      size="sm"
                      value={toNum(loRaw)}
                      onChange={(v: number) =>
                        updateRule(i, { value: `${v},${hiRaw ?? ""}` })
                      }
                      width={90}
                    />
                    <Text type="supporting" color="secondary">
                      and
                    </Text>
                    <NumberInput
                      label=""
                      isLabelHidden
                      size="sm"
                      value={toNum(hiRaw)}
                      onChange={(v: number) =>
                        updateRule(i, { value: `${loRaw ?? ""},${v}` })
                      }
                      width={90}
                    />
                  </FormLayout>
                ) : numeric ? (
                  <NumberInput
                    label=""
                    isLabelHidden
                    size="sm"
                    value={numericValue}
                    onChange={(v: number) => updateRule(i, { value: v })}
                    width={110}
                  />
                ) : (
                  <TextInput
                    label=""
                    isLabelHidden
                    size="sm"
                    value={typeof r.value === "string" ? r.value : ""}
                    onChange={(v: string) => updateRule(i, { value: v })}
                    width={120}
                  />
                )}

                <Button
                  label={`Remove ${field.label} condition`}
                  variant="ghost"
                  size="sm"
                  isIconOnly
                  icon={<Trash2 size="1em" />}
                  onClick={() => removeRule(i)}
                />
              </FormLayout>
            </Card>
          );
        })}
      </HStack>

      {sentence && (
        <Text type="supporting" color="secondary">
          When {sentence}
        </Text>
      )}
    </VStack>
  );
}
