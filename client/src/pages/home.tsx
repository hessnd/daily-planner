import { useMemo, useState } from "react";
import {
  DEFAULT_SLOTS,
  DAYS,
  TARGET_WAKE_MIN,
  Slot,
  buildWakePlan,
  computeBedtime,
  fmtDuration,
  fmtTime,
  fmtTime24,
  layoutSchedule,
  parseTime24,
} from "@/lib/planner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/lib/theme";
import {
  Sun,
  Moon,
  Printer,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Bed,
  Coffee,
  Sparkles,
} from "lucide-react";

const SLOT_COLORS: Record<string, string> = {
  wake: "bg-amber-100 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200",
  dog: "bg-emerald-100 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200",
  shower: "bg-sky-100 dark:bg-sky-950/40 border-sky-300 dark:border-sky-800 text-sky-900 dark:text-sky-200",
  breakfast: "bg-orange-100 dark:bg-orange-950/40 border-orange-300 dark:border-orange-800 text-orange-900 dark:text-orange-200",
  exercise: "bg-rose-100 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200",
  meditation: "bg-violet-100 dark:bg-violet-950/40 border-violet-300 dark:border-violet-800 text-violet-900 dark:text-violet-200",
  journal: "bg-indigo-100 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200",
  custom: "bg-stone-100 dark:bg-stone-900/60 border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-200",
};

export default function Home() {
  const { theme, toggle } = useTheme();

  // ── Form state ──
  const [sleepHours, setSleepHours] = useState(7.5);
  const [currentWake, setCurrentWake] = useState("07:00"); // user's current habitual wake
  const [fallAsleepBuffer, setFallAsleepBuffer] = useState(15);
  const [planStartDate, setPlanStartDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [slots, setSlots] = useState<Slot[]>(DEFAULT_SLOTS);
  const [newSlotLabel, setNewSlotLabel] = useState("");
  const [newSlotDuration, setNewSlotDuration] = useState(10);

  // ── Derived ──
  const targetWake = TARGET_WAKE_MIN;
  const targetBedtime = computeBedtime(targetWake, sleepHours, fallAsleepBuffer);
  const currentWakeMin = parseTime24(currentWake);
  const currentBedtime = computeBedtime(currentWakeMin, sleepHours, fallAsleepBuffer);
  const shiftNeeded = Math.max(0, currentWakeMin - targetWake);

  const schedule = useMemo(() => layoutSchedule(slots, targetWake), [slots, targetWake]);
  const totalRoutineMin = schedule.length
    ? schedule[schedule.length - 1].endMinutes - targetWake
    : 0;

  const wakePlan = useMemo(() => {
    const start = new Date(planStartDate + "T00:00:00");
    return buildWakePlan(currentWakeMin, targetWake, sleepHours, 14, start, fallAsleepBuffer);
  }, [currentWakeMin, sleepHours, planStartDate, fallAsleepBuffer]);

  // ── Slot mutators ──
  const updateSlot = (id: string, patch: Partial<Slot>) =>
    setSlots((arr) => arr.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const moveSlot = (id: string, dir: -1 | 1) =>
    setSlots((arr) => {
      const i = arr.findIndex((s) => s.id === id);
      if (i < 0) return arr;
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      const next = [...arr];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const removeSlot = (id: string) =>
    setSlots((arr) => arr.filter((s) => s.id !== id || s.fixed));

  const addSlot = () => {
    const label = newSlotLabel.trim();
    if (!label) return;
    setSlots((arr) => [
      ...arr,
      {
        id: `custom-${Date.now()}`,
        label,
        kind: "custom",
        duration: newSlotDuration,
        enabled: true,
        emoji: "✨",
      },
    ]);
    setNewSlotLabel("");
    setNewSlotDuration(10);
  };

  const handlePrint = () => window.print();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* HERO */}
      <header className="no-print relative overflow-hidden border-b border-border">
        <div className="dawn-gradient absolute inset-0 opacity-[0.08] dark:opacity-[0.18]" aria-hidden />
        <div className="relative max-w-6xl mx-auto px-6 py-10 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full dawn-gradient grid place-items-center">
                <Sun className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-sm font-medium tracking-wide uppercase text-muted-foreground">
                Dawn · Morning Routine Planner
              </span>
            </div>
            <h1
              className="text-3xl md:text-4xl font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-serif)" }}
              data-testid="text-page-title"
            >
              Build a 5:45 AM you'll actually keep.
            </h1>
            <p className="mt-2 text-muted-foreground max-w-xl">
              Plan a calm, mandatory dog walk, shower, breakfast — plus the slots
              that matter to you. Compute bedtime, ease into your wake time over
              two weeks, and print the week.
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={toggle}
            aria-label="Toggle theme"
            data-testid="button-theme-toggle"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        {/* ─── Top row: Sleep config + bedtime calc ─── */}
        <section className="no-print grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bed className="w-4 h-4" /> Your sleep
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <Label htmlFor="sleep-hours">Sleep needed</Label>
                    <span className="font-mono text-sm" data-testid="text-sleep-hours">
                      {sleepHours.toFixed(1)} hrs
                    </span>
                  </div>
                  <Slider
                    id="sleep-hours"
                    min={6}
                    max={10}
                    step={0.25}
                    value={[sleepHours]}
                    onValueChange={(v) => setSleepHours(v[0])}
                    data-testid="slider-sleep-hours"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground font-mono">
                    <span>6h</span>
                    <span>8h</span>
                    <span>10h</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <Label htmlFor="buffer">Fall-asleep buffer</Label>
                    <span className="font-mono text-sm" data-testid="text-buffer">
                      {fallAsleepBuffer} min
                    </span>
                  </div>
                  <Slider
                    id="buffer"
                    min={0}
                    max={45}
                    step={5}
                    value={[fallAsleepBuffer]}
                    onValueChange={(v) => setFallAsleepBuffer(v[0])}
                    data-testid="slider-buffer"
                  />
                  <p className="text-xs text-muted-foreground">
                    Time between getting in bed and actually drifting off.
                  </p>
                </div>
              </div>

              <Separator />

              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="current-wake">Your current wake time</Label>
                  <Input
                    id="current-wake"
                    type="time"
                    value={currentWake}
                    onChange={(e) => setCurrentWake(e.target.value)}
                    className="font-mono"
                    data-testid="input-current-wake"
                  />
                  <p className="text-xs text-muted-foreground">
                    What time do you wake up <em>today</em>? We'll ease you back to 5:45 from here.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="start-date">Plan start date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={planStartDate}
                    onChange={(e) => setPlanStartDate(e.target.value)}
                    className="font-mono"
                    data-testid="input-start-date"
                  />
                  <p className="text-xs text-muted-foreground">
                    Day 1 of the 14-day shift starts on this date.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bedtime card */}
          <Card className="dawn-gradient text-white border-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-white/90">
                <Sparkles className="w-4 h-4" /> Your target rhythm
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <div className="text-xs uppercase tracking-wide text-white/70">Wake</div>
                <div
                  className="font-semibold text-2xl"
                  style={{ fontFamily: "var(--font-serif)" }}
                  data-testid="text-target-wake"
                >
                  {fmtTime(targetWake)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-white/70">In bed by</div>
                <div
                  className="font-semibold text-2xl"
                  style={{ fontFamily: "var(--font-serif)" }}
                  data-testid="text-target-bedtime"
                >
                  {fmtTime(targetBedtime)}
                </div>
                <div className="text-xs text-white/70 mt-1 font-mono">
                  = {sleepHours}h sleep + {fallAsleepBuffer}m to drift off
                </div>
              </div>
              {shiftNeeded > 0 && (
                <div className="pt-3 border-t border-white/15">
                  <div className="text-xs uppercase tracking-wide text-white/70">Shift needed</div>
                  <div className="font-mono text-sm mt-1" data-testid="text-shift-needed">
                    {fmtDuration(shiftNeeded)} earlier · over 14 days
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ─── Routine builder ─── */}
        <section className="no-print">
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold" style={{ fontFamily: "var(--font-serif)" }}>
                Your morning blocks
              </h2>
              <p className="text-sm text-muted-foreground">
                Reorder, resize, toggle. Mandatory blocks are marked.
              </p>
            </div>
            <Badge variant="outline" className="font-mono" data-testid="badge-total-duration">
              {fmtDuration(totalRoutineMin)} total · ends {fmtTime(targetWake + totalRoutineMin)}
            </Badge>
          </div>

          <div className="space-y-2">
            {slots.map((s, i) => (
              <SlotRow
                key={s.id}
                slot={s}
                index={i}
                total={slots.length}
                onUpdate={(patch) => updateSlot(s.id, patch)}
                onMove={(dir) => moveSlot(s.id, dir)}
                onRemove={() => removeSlot(s.id)}
              />
            ))}
          </div>

          {/* Add new */}
          <div className="mt-4 flex flex-col sm:flex-row gap-2 items-stretch sm:items-end p-4 rounded-lg border border-dashed border-border bg-muted/30">
            <div className="flex-1 space-y-1">
              <Label htmlFor="new-slot-label" className="text-xs">
                Add a custom block
              </Label>
              <Input
                id="new-slot-label"
                placeholder="e.g. Read · Stretch · Cold plunge"
                value={newSlotLabel}
                onChange={(e) => setNewSlotLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSlot()}
                data-testid="input-new-slot-label"
              />
            </div>
            <div className="w-full sm:w-32 space-y-1">
              <Label htmlFor="new-slot-duration" className="text-xs">
                Minutes
              </Label>
              <Input
                id="new-slot-duration"
                type="number"
                min={1}
                max={120}
                value={newSlotDuration}
                onChange={(e) => setNewSlotDuration(parseInt(e.target.value) || 1)}
                className="font-mono"
                data-testid="input-new-slot-duration"
              />
            </div>
            <Button onClick={addSlot} data-testid="button-add-slot">
              <Plus className="w-4 h-4 mr-1" /> Add block
            </Button>
          </div>
        </section>

        {/* ─── Today's timeline ─── */}
        <section className="no-print">
          <h2
            className="text-xl font-semibold mb-4"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Today's timeline
          </h2>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {schedule.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-stretch"
                    data-testid={`timeline-${s.id}`}
                  >
                    <div className="w-28 sm:w-36 px-4 py-3 border-r border-border bg-muted/30 grid place-items-center">
                      <div className="font-mono text-sm font-semibold">
                        {fmtTime(s.startMinutes)}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">
                        → {fmtTime(s.endMinutes)}
                      </div>
                    </div>
                    <div className={`flex-1 px-4 py-3 border-l-4 ${SLOT_COLORS[s.kind]}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-lg" aria-hidden>
                          {s.emoji}
                        </span>
                        <span className="font-medium">{s.label}</span>
                        {s.fixed && (
                          <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                            Mandatory
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                        {fmtDuration(s.duration)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ─── 14-day wake plan ─── */}
        <section className="no-print">
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2
                className="text-xl font-semibold"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                14-day gradual wake-up
              </h2>
              <p className="text-sm text-muted-foreground">
                Shift {fmtDuration(shiftNeeded)} earlier in 5-minute steps.
              </p>
            </div>
          </div>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-muted-foreground">
                      Day
                    </th>
                    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-muted-foreground">
                      Date
                    </th>
                    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-muted-foreground">
                      Bedtime
                    </th>
                    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-muted-foreground">
                      Wake
                    </th>
                    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-muted-foreground">
                      Shift
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {wakePlan.map((d) => {
                    const isFinal = d.wakeMinutes === targetWake;
                    return (
                      <tr
                        key={d.day}
                        className={`border-b border-border/60 ${isFinal ? "bg-primary/5" : ""}`}
                        data-testid={`row-day-${d.day}`}
                      >
                        <td className="px-4 py-2.5 font-mono">
                          <div className="flex items-center gap-2">
                            <span>{d.day}</span>
                            {isFinal && <Sun className="w-3 h-3 text-primary" />}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">
                          {d.date.toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-2.5 font-mono">{fmtTime(d.bedtimeMinutes)}</td>
                        <td className="px-4 py-2.5 font-mono font-semibold">
                          {fmtTime(d.wakeMinutes)}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                          {d.shiftFromCurrent === 0
                            ? "—"
                            : `${d.shiftFromCurrent} min earlier`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </section>

        {/* ─── Print CTA ─── */}
        <section className="no-print">
          <Card className="border-dashed">
            <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-md bg-primary/10 grid place-items-center">
                  <Printer className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold">Printable weekly schedule</div>
                  <p className="text-sm text-muted-foreground">
                    A clean Mon–Fri grid with time blocks. Stick it on the fridge.
                  </p>
                </div>
              </div>
              <Button onClick={handlePrint} data-testid="button-print">
                <Printer className="w-4 h-4 mr-2" /> Print weekly schedule
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>

      {/* ─── Print-only weekly schedule ─── */}
      <PrintableWeek
        schedule={schedule}
        targetWake={targetWake}
        targetBedtime={targetBedtime}
        sleepHours={sleepHours}
      />

      <footer className="no-print border-t border-border mt-16 py-8">
        <div className="max-w-6xl mx-auto px-6 text-xs text-muted-foreground flex flex-wrap gap-2 justify-between">
          <span>Dawn · A morning routine planner.</span>
          <span className="font-mono">
            Target {fmtTime24(targetWake)} · {sleepHours}h sleep
          </span>
        </div>
      </footer>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────

function SlotRow({
  slot,
  index,
  total,
  onUpdate,
  onMove,
  onRemove,
}: {
  slot: Slot;
  index: number;
  total: number;
  onUpdate: (patch: Partial<Slot>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-2 sm:gap-3 p-3 rounded-lg border ${
        slot.enabled ? "border-border bg-card" : "border-border/60 bg-muted/30 opacity-60"
      }`}
      data-testid={`slot-row-${slot.id}`}
    >
      <div className="flex flex-col">
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => onMove(-1)}
          disabled={index === 0}
          aria-label="Move up"
          data-testid={`button-up-${slot.id}`}
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => onMove(1)}
          disabled={index === total - 1}
          aria-label="Move down"
          data-testid={`button-down-${slot.id}`}
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </Button>
      </div>

      <GripVertical className="w-4 h-4 text-muted-foreground hidden sm:block" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-base" aria-hidden>
            {slot.emoji}
          </span>
          <Input
            value={slot.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            className="h-8 max-w-[14rem] text-sm font-medium"
            disabled={slot.fixed && (slot.kind === "wake")}
            data-testid={`input-label-${slot.id}`}
          />
          {slot.fixed && (
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
              Mandatory
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={1}
          max={120}
          value={slot.duration}
          onChange={(e) =>
            onUpdate({ duration: Math.max(1, parseInt(e.target.value) || 1) })
          }
          className="w-16 h-8 text-sm font-mono"
          aria-label="Minutes"
          data-testid={`input-duration-${slot.id}`}
        />
        <span className="text-xs text-muted-foreground font-mono w-8">min</span>
      </div>

      <Switch
        checked={slot.enabled}
        onCheckedChange={(v) => onUpdate({ enabled: v })}
        disabled={slot.fixed}
        aria-label={`Enable ${slot.label}`}
        data-testid={`switch-${slot.id}`}
      />

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onRemove}
        disabled={slot.fixed}
        aria-label="Remove"
        data-testid={`button-remove-${slot.id}`}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

function PrintableWeek({
  schedule,
  targetWake,
  targetBedtime,
  sleepHours,
}: {
  schedule: ReturnType<typeof layoutSchedule>;
  targetWake: number;
  targetBedtime: number;
  sleepHours: number;
}) {
  return (
    <div className="print-only" style={{ color: "black", background: "white" }}>
      <div style={{ padding: "0.25in" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            borderBottom: "2px solid black",
            paddingBottom: "0.15in",
            marginBottom: "0.2in",
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: "Fraunces, Georgia, serif",
                fontSize: "28pt",
                fontWeight: 600,
                margin: 0,
              }}
            >
              Morning Routine · Weekly Schedule
            </h1>
            <div style={{ fontSize: "10pt", marginTop: "4pt", color: "#444" }}>
              Wake {fmtTime(targetWake)} · Bedtime {fmtTime(targetBedtime)} · {sleepHours}h sleep
            </div>
          </div>
          <Coffee size={32} />
        </div>

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: "Inter, sans-serif",
            fontSize: "9pt",
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1.5px solid black",
                  padding: "6pt 4pt",
                  width: "16%",
                  fontSize: "8pt",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Time
              </th>
              {DAYS.map((d) => (
                <th
                  key={d}
                  style={{
                    textAlign: "left",
                    borderBottom: "1.5px solid black",
                    padding: "6pt 4pt",
                    fontSize: "8pt",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {schedule.map((s) => (
              <tr key={s.id}>
                <td
                  style={{
                    borderBottom: "0.5px solid #ccc",
                    padding: "10pt 4pt",
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: "8.5pt",
                    verticalAlign: "top",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{fmtTime(s.startMinutes)}</div>
                  <div style={{ color: "#666", fontSize: "7.5pt" }}>
                    → {fmtTime(s.endMinutes)}
                  </div>
                </td>
                {DAYS.map((d) => (
                  <td
                    key={d}
                    style={{
                      borderBottom: "0.5px solid #ccc",
                      borderLeft: "0.5px solid #eee",
                      padding: "10pt 6pt",
                      verticalAlign: "top",
                    }}
                  >
                    <div style={{ fontWeight: 500 }}>
                      {s.emoji} {s.label}
                    </div>
                    <div style={{ color: "#666", fontSize: "7.5pt", marginTop: "2pt" }}>
                      {fmtDuration(s.duration)}
                      {s.fixed ? " · mandatory" : ""}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
            {/* Bedtime row */}
            <tr>
              <td
                style={{
                  borderTop: "1.5px solid black",
                  padding: "10pt 4pt",
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "8.5pt",
                  fontWeight: 600,
                  verticalAlign: "top",
                }}
              >
                {fmtTime(targetBedtime)}
              </td>
              {DAYS.map((d) => (
                <td
                  key={d}
                  style={{
                    borderTop: "1.5px solid black",
                    borderLeft: "0.5px solid #eee",
                    padding: "10pt 6pt",
                    fontWeight: 500,
                  }}
                >
                  🌙 In bed · lights out
                </td>
              ))}
            </tr>
          </tbody>
        </table>

        <div
          style={{
            marginTop: "0.3in",
            paddingTop: "0.15in",
            borderTop: "0.5px solid #ccc",
            fontSize: "8pt",
            color: "#666",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>Dawn · Morning Routine Planner</span>
          <span>{new Date().toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}
