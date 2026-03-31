"use client";

import { cn } from "~/lib/utils";

// ─── Palette predefinita ──────────────────────────────────

const PRESET_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#a855f7", // purple
  "#ec4899", // pink
  "#64748b", // slate
  "#78716c", // stone
];

// ─── Types ────────────────────────────────────────────────

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

// ─── Component ───────────────────────────────────────────

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  // Normalizza il valore in ingresso
  const currentColor = value?.startsWith("#") ? value : "#6366f1";

  function handleHexInput(raw: string) {
    // Aggiunge # se manca
    const normalized = raw.startsWith("#") ? raw : `#${raw}`;
    onChange(normalized);
  }

  function isValidHex(color: string) {
    return /^#[0-9A-Fa-f]{6}$/.test(color);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Palette colori predefiniti */}
      <div className="grid grid-cols-6 gap-2">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={cn(
              "h-8 w-8 rounded-full border-2 transition-transform hover:scale-110",
              currentColor === color
                ? "border-foreground scale-110 shadow-md"
                : "border-transparent"
            )}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>

      {/* Input HEX manuale + color input nativo + preview */}
      <div className="flex items-center gap-2">
        {/* Color picker nativo come swatch cliccabile */}
        <div className="relative h-9 w-9 overflow-hidden rounded-md border">
          <div
            className="absolute inset-0"
            style={{ backgroundColor: isValidHex(currentColor) ? currentColor : "#6366f1" }}
          />
          <input
            type="color"
            value={isValidHex(currentColor) ? currentColor : "#6366f1"}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            title="Scegli colore"
          />
        </div>

        {/* Input HEX testuale */}
        <input
          type="text"
          value={currentColor}
          onChange={(e) => handleHexInput(e.target.value)}
          maxLength={7}
          placeholder="#6366f1"
          className={cn(
            "h-9 w-28 rounded-md border px-3 text-sm font-mono tracking-wider outline-none transition-colors",
            "focus:border-ring focus:ring-2 focus:ring-ring/20",
            !isValidHex(currentColor) && currentColor.length > 1
              ? "border-destructive text-destructive"
              : "border-input"
          )}
        />

        {/* Preview badge come verrà visualizzata la categoria */}
        <span
          className="rounded-full px-3 py-1 text-xs font-medium text-white transition-colors"
          style={{
            backgroundColor: isValidHex(currentColor) ? currentColor : "#6366f1",
          }}
        >
          Anteprima
        </span>
      </div>
    </div>
  );
}
