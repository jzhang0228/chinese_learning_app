"use client";

interface ProgressBarProps {
  step: number;
  total: number;
  label: string;
}

export default function ProgressBar({ step, total, label }: ProgressBarProps) {
  const pct = Math.round((step / total) * 100);
  return (
    <div className="w-full mb-6">
      <div className="flex justify-between text-sm mb-1.5">
        <span className="font-medium" style={{ color: "var(--foreground)" }}>{label}</span>
        <span style={{ color: "var(--muted)" }}>
          {step}/{total}
        </span>
      </div>
      <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--primary-light)" }}>
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg, #3b82f6, #10b981)" }}
        />
      </div>
    </div>
  );
}
