import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { categories } from "@/data/catalog";

/** Multi-select dropdown of experience categories. */
export function PreferencePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const label = value.length
    ? categories.filter((c) => value.includes(c.slug)).map((c) => c.name.split(" ")[0]).join(", ")
    : "Choose what you love…";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="flex w-full items-center justify-between rounded-xl border-[1.5px] border-ink bg-elevated px-4 py-2.5 text-left text-sm">
          <span className={value.length ? "text-ink" : "text-ink-muted"}>{label}</span>
          <span aria-hidden="true">▾</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 border-[1.5px] border-ink bg-paper p-2" align="start">
        {categories.map((c) => {
          const on = value.includes(c.slug);
          return (
            <label key={c.slug} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-parchment">
              <Checkbox checked={on} onCheckedChange={() => onChange(on ? value.filter((v) => v !== c.slug) : [...value, c.slug])} />
              <span>{c.name}</span>
            </label>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
