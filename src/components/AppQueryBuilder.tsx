"use client";

import {
  Button,
  CheckboxInput,
  DropdownMenu,
  NumberInput,
  TextInput,
} from "@astryxdesign/core";
import {
  type ActionProps,
  type ControlElementsProp,
  type FullField,
  type ValueEditorProps,
  type ValueSelectorProps,
} from "react-querybuilder";

function BetweenEditor({
  value,
  handleOnChange,
}: {
  value: string;
  handleOnChange: (val: string) => void;
}) {
  const parts = (value || "").split(",");
  const lo = parts[0] ?? "";
  const hi = parts[1] ?? "";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <TextInput
        label=""
        value={lo}
        onChange={(v: string) => handleOnChange(`${v},${hi}`)}
        size="sm"
        placeholder="Min"
      />
      <span
        style={{ color: "var(--color-text-secondary)", fontSize: "0.75rem" }}
      >
        and
      </span>
      <TextInput
        label=""
        value={hi}
        onChange={(v: string) => handleOnChange(`${lo},${v}`)}
        size="sm"
        placeholder="Max"
      />
    </div>
  );
}

export const AppQueryBuilderElements: ControlElementsProp<FullField, string> = {
  actionElement: ({ handleOnClick, title }: ActionProps) => (
    <Button label={title!} variant="ghost" onClick={handleOnClick} />
  ),
  removeRuleAction: ({ handleOnClick }: ActionProps) => (
    <Button variant="ghost" size="sm" label="X" onClick={handleOnClick} />
  ),

  valueSelector: ({ value, handleOnChange, options }: ValueSelectorProps) => (
    <DropdownMenu
      button={{ label: value!, variant: "ghost" }}
      items={options.map((op) => ({
        label: op.label,
        value: op.label,
        onClick: () => handleOnChange("value" in op ? op.value : op.label),
      }))}
    />
  ),

  valueEditor: ({
    value,
    handleOnChange,
    type,
    inputType,
    operator,
  }: ValueEditorProps) => {
    const isNull = operator === "isSet";
    const isBetween = operator === "between" || operator === "notBetween";

    if (isNull) return null;
    if (isBetween) {
      return (
        <BetweenEditor value={value ?? ""} handleOnChange={handleOnChange} />
      );
    }

    if (inputType === "number") {
      return <NumberInput label="" value={value} onChange={handleOnChange} />;
    }
    if (type === "checkbox" || inputType === "boolean") {
      return (
        <CheckboxInput label="" value={!!value} onChange={handleOnChange} />
      );
    }

    return <TextInput label="" value={value || ""} onChange={handleOnChange} />;
  },
};
