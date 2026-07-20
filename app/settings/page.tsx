"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Button,
  Input,
  SettingsGroup,
  SettingsItem,
  PageHeader,
} from "@takaki/go-design-system";
import { toast } from "@takaki/go-design-system";

const DEFAULTS = {
  baseline_repeating: 500,
  baseline_shadowing: 75,
  baseline_output: 2,
  baseline_input: 1,
  ef_set_interval_months: 3,
};

type SettingsValues = typeof DEFAULTS;

export default function SettingsRoute() {
  const supabase = createClient();
  const [values, setValues] = useState<SettingsValues>(DEFAULTS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setValues({
          baseline_repeating:
            data.baseline_repeating ?? DEFAULTS.baseline_repeating,
          baseline_shadowing:
            data.baseline_shadowing ?? DEFAULTS.baseline_shadowing,
          baseline_output: data.baseline_output ?? DEFAULTS.baseline_output,
          baseline_input: data.baseline_input ?? DEFAULTS.baseline_input,
          ef_set_interval_months:
            data.ef_set_interval_months ?? DEFAULTS.ef_set_interval_months,
        });
      }
    }
    load();
  }, [supabase]);

  const handleSave = async () => {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("user_settings")
      .upsert(
        { user_id: user.id, ...values, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );

    if (error) {
      toast.error("Failed to save");
    } else {
      toast.success("Saved");
    }
    setSaving(false);
  };

  const set =
    (key: keyof SettingsValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setValues((v) => ({ ...v, [key]: parseInt(e.target.value) || 0 }));

  function NumberInput({
    fieldKey,
    unit,
  }: {
    fieldKey: keyof SettingsValues;
    unit: string;
  }) {
    return (
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          value={values[fieldKey]}
          onChange={set(fieldKey)}
          className="w-24 text-right"
        />
        <span className="text-sm text-muted-foreground w-24 shrink-0 whitespace-nowrap">
          {unit}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-lg">
      <PageHeader title="Settings" />

      <SettingsGroup
        title="Baseline"
        description="Your weekly baseline is the minimum amount of practice you want to maintain. It's not a target to hit, but a floor you're aiming not to fall below."
      >
        <SettingsItem
          label="Repeating"
          control={<NumberInput fieldKey="baseline_repeating" unit="reps/week" />}
        />
        <SettingsItem
          label="Shadowing"
          control={<NumberInput fieldKey="baseline_shadowing" unit="min/week" />}
        />
        <SettingsItem
          label="Output"
          control={<NumberInput fieldKey="baseline_output" unit="entries/week" />}
        />
        <SettingsItem
          label="Input"
          control={<NumberInput fieldKey="baseline_input" unit="rounds/week" />}
        />
      </SettingsGroup>

      <SettingsGroup
        title="EF SET"
        description="Set how often you take the EF SET, in months. Once that many months have passed since your last attempt, a reminder banner appears on the dashboard."
      >
        <SettingsItem
          label="Interval"
          control={
            <NumberInput fieldKey="ef_set_interval_months" unit="months" />
          }
        />
      </SettingsGroup>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
