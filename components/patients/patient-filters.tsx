"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

const ANY = "__any__";

export type PatientFiltersValue = {
  age: [number, number];
  gender: string;
  conditions: string[];
};

export function PatientFilters({
  conditionOptions,
  initial,
}: {
  conditionOptions: string[];
  initial: PatientFiltersValue;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [age, setAge] = useState<[number, number]>(initial.age);
  const [gender, setGender] = useState<string>(initial.gender || ANY);
  const [conditions, setConditions] = useState<string[]>(initial.conditions);

  // Keep state in sync if user uses back/forward navigation.
  useEffect(() => {
    setAge(initial.age);
    setGender(initial.gender || ANY);
    setConditions(initial.conditions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  const buildHref = useCallback(
    (next: PatientFiltersValue) => {
      const params = new URLSearchParams();
      if (next.age[0] !== 0) params.set("minAge", String(next.age[0]));
      if (next.age[1] !== 100) params.set("maxAge", String(next.age[1]));
      if (next.gender && next.gender !== ANY) params.set("gender", next.gender);
      for (const c of next.conditions) params.append("condition", c);
      const qs = params.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname],
  );

  const applyFilters = useCallback(
    (next: Partial<PatientFiltersValue>) => {
      const value: PatientFiltersValue = {
        age: next.age ?? age,
        gender: next.gender ?? gender,
        conditions: next.conditions ?? conditions,
      };
      router.push(buildHref({ ...value, gender: value.gender === ANY ? "" : value.gender }));
    },
    [router, buildHref, age, gender, conditions],
  );

  const toggleCondition = (description: string) => {
    const next = conditions.includes(description)
      ? conditions.filter((c) => c !== description)
      : [...conditions, description];
    setConditions(next);
    applyFilters({ conditions: next });
  };

  const reset = () => {
    setAge([0, 100]);
    setGender(ANY);
    setConditions([]);
    router.push(pathname);
  };

  const conditionLabel = useMemo(() => {
    if (conditions.length === 0) return "Conditions";
    if (conditions.length === 1) return conditions[0];
    return `${conditions.length} conditions`;
  }, [conditions]);

  return (
    <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-card p-4 shadow-sm">
      <div className="min-w-56 flex-1">
        <Label className="text-xs text-muted-foreground">
          Age: {age[0]} – {age[1]}
        </Label>
        <Slider
          className="mt-2"
          min={0}
          max={100}
          step={1}
          minStepsBetweenThumbs={0}
          value={age}
          onValueChange={(v) => setAge([v[0], v[1]] as [number, number])}
          onValueCommit={(v) => applyFilters({ age: [v[0], v[1]] as [number, number] })}
        />
      </div>

      <div className="w-40">
        <Label className="text-xs text-muted-foreground">Gender</Label>
        <Select
          value={gender}
          onValueChange={(value) => {
            setGender(value);
            applyFilters({ gender: value });
          }}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Any" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any</SelectItem>
            <SelectItem value="F">Female</SelectItem>
            <SelectItem value="M">Male</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="w-64">
        <Label className="text-xs text-muted-foreground">Condition</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="mt-1 w-full justify-between font-normal">
              <span className="truncate">{conditionLabel}</span>
              <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" align="start">
            <div className="max-h-80 overflow-y-auto">
              {conditionOptions.map((c) => {
                const id = `cond-${c.replace(/\s+/g, "-")}`;
                const checked = conditions.includes(c);
                return (
                  <div
                    key={c}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
                  >
                    <Checkbox
                      id={id}
                      checked={checked}
                      onCheckedChange={() => toggleCondition(c)}
                    />
                    <Label htmlFor={id} className="cursor-pointer text-sm font-normal">
                      {c}
                    </Label>
                  </div>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <Button variant="ghost" onClick={reset} className="ml-auto">
        Reset
      </Button>

      {conditions.length > 0 && (
        <div className="flex w-full flex-wrap gap-2 border-t pt-3">
          {conditions.map((c) => (
            <Badge key={c} variant="secondary" className="gap-1">
              {c}
              <button
                type="button"
                onClick={() => toggleCondition(c)}
                className="rounded p-0.5 hover:bg-background"
                aria-label={`Remove ${c}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
