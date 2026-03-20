import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useI18n } from "@/i18n";

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
}

const MODELS: ModelOption[] = [
  { id: "claude-sonnet-4-6", name: "Sonnet 4.6", provider: "Anthropic" },
  { id: "claude-opus-4-6", name: "Opus 4.6", provider: "Anthropic" },
];

interface ModelSelectorProps {
  selected: string | null;
  onSelect: (id: string) => void;
}

export function ModelSelector({ selected, onSelect }: ModelSelectorProps) {
  const { t } = useI18n();

  return (
    <div className="mt-5">
      <label className="block text-xs font-medium text-muted-foreground mb-2.5 uppercase tracking-wider font-mono">
        {t("modelTargetLabel")}
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
        {MODELS.map((model) => {
          const isSelected = selected === model.id;
          return (
            <motion.button
              key={model.id}
              onClick={() => onSelect(model.id)}
              whileTap={{ scale: 0.98 }}
              className={`relative min-h-[68px] p-2.5 rounded-lg border text-left transition-all duration-200 ${
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-transparent bg-muted hover:border-border"
              }`}
            >
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-2.5 right-2.5 w-4.5 h-4.5 rounded-full bg-primary flex items-center justify-center"
                >
                  <Check className="w-3 h-3 text-primary-foreground" />
                </motion.div>
              )}
              <div className="text-sm font-semibold text-foreground leading-tight">{model.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5 font-mono">{model.provider}</div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
