"use client";

import { useActionState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  Input,
  Select,
  Checkbox,
  SubmitButton,
} from "@/components/ui/form-controls";
import { saveSystemSettings, type ActionState } from "../actions";

export type SettingRow = {
  key: string;
  label: string;
  description: string | null;
  category: string;
  fieldType: string;
  value: unknown;
  options: string[] | null;
};

export function SettingInput({ s }: { s: SettingRow }) {
  switch (s.fieldType) {
    case "boolean":
      return (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name={s.key} defaultChecked={!!s.value} />
          Enabled
        </label>
      );
    case "number":
      return <Input name={s.key} type="number" defaultValue={String(s.value ?? "")} />;
    case "select":
      return (
        <Select name={s.key} defaultValue={String(s.value ?? "")}>
          {(s.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      );
    case "json":
      return (
        <Input
          name={s.key}
          defaultValue={JSON.stringify(s.value)}
          className="font-mono text-xs"
        />
      );
    default:
      return <Input name={s.key} type={s.fieldType === "email" ? "email" : "text"} defaultValue={String(s.value ?? "")} />;
  }
}

export function SystemSettingsForm({
  settings,
  canManage,
}: {
  settings: SettingRow[];
  canManage: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const r = await saveSystemSettings(prev, fd);
      if (r.ok) toast.success("Settings saved");
      return r;
    },
    {}
  );

  const categories = [...new Set(settings.map((s) => s.category))];

  return (
    <form action={action} className="space-y-4">
      {settings.map((s) => (
        <input key={s.key} type="hidden" name={`__type:${s.key}`} value={s.fieldType} />
      ))}
      {settings.map((s) => (
        <input key={`k-${s.key}`} type="hidden" name="__keys" value={s.key} />
      ))}
      <fieldset disabled={!canManage} className="space-y-4">
        {categories.map((cat) => (
          <Card key={cat}>
            <CardHeader>
              <CardTitle>{cat}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {settings
                .filter((s) => s.category === cat)
                .map((s) => (
                  <Field
                    key={s.key}
                    label={s.label}
                    hint={s.description ?? undefined}
                  >
                    <SettingInput s={s} />
                  </Field>
                ))}
            </CardContent>
          </Card>
        ))}
      </fieldset>
      {state.error && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-brand-red">
          {state.error}
        </p>
      )}
      {canManage && (
        <div className="flex justify-end">
          <SubmitButton>Save settings</SubmitButton>
        </div>
      )}
    </form>
  );
}
