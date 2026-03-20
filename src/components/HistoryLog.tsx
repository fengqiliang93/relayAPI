import { Fragment, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle } from "lucide-react";
import { useI18n } from "@/i18n";
import type { CheckItem } from "@/components/DetectionChecklist";

export interface HistoryEntry {
  id: string;
  timestamp: string;
  model: string;
  endpoint: string;
  apiKey: string;
  score: number;
  status: "pass" | "fail";
  checks?: CheckItem[];
  latency?: number;
  tps?: number;
  inputTokens?: number;
  outputTokens?: number;
}

interface HistoryLogProps {
  entries: HistoryEntry[];
  onSelect?: (entry: HistoryEntry) => void;
  onClear?: () => void;
}

function getEndpointDisplay(endpoint: string): string {
  const trimmed = endpoint.trim();
  if (!trimmed) return "-";

  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return parsed.hostname || trimmed;
  } catch {
    return trimmed.replace(/^https?:\/\//i, "").split("/")[0] || trimmed;
  }
}

function getCompactTimestamp(timestamp: string): string {
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timestamp)) {
    return timestamp.slice(5, 16);
  }
  return timestamp;
}

function hasExpandableContent(entry: HistoryEntry): boolean {
  return Boolean(
    entry.checks?.length ||
    entry.latency !== undefined ||
    entry.tps !== undefined ||
    entry.inputTokens !== undefined ||
    entry.outputTokens !== undefined,
  );
}

export function HistoryLog({ entries, onSelect, onClear }: HistoryLogProps) {
  const { t } = useI18n();
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  if (entries.length === 0) {
    return (
      <div className="py-2">
        <div className="mb-4">
          <h3 className="text-lg font-semibold tracking-tight text-foreground">{t("historyTitle")}</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-3">
            <span className="text-2xl">🔬</span>
          </div>
          <p className="text-sm font-medium">{t("historyEmptyTitle")}</p>
          <p className="text-xs mt-1">{t("historyEmptyDescription")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-2">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold tracking-tight text-foreground">{t("historyTitle")}</h3>
        {entries.length > 0 && onClear && (
          <button
            onClick={onClear}
            className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("historyClear")}
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="w-[88px] sm:w-auto text-left py-2 text-xs font-mono text-muted-foreground uppercase tracking-wider font-medium">{t("historyTimestamp")}</th>
              <th className="w-[72px] sm:w-auto text-left py-2 text-xs font-mono text-muted-foreground uppercase tracking-wider font-medium">{t("historyModel")}</th>
              <th className="w-[92px] sm:w-auto text-left py-2 text-xs font-mono text-muted-foreground uppercase tracking-wider font-medium">{t("historyEndpoint")}</th>
              <th className="w-[48px] sm:w-auto text-right py-2 text-xs font-mono text-muted-foreground uppercase tracking-wider font-medium">{t("historyScore")}</th>
              <th className="w-[40px] sm:w-auto text-center py-2 text-xs font-mono text-muted-foreground uppercase tracking-wider font-medium">{t("historyStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
                const isExpanded = expandedEntryId === entry.id;
                const canExpand = hasExpandableContent(entry);

                return (
                  <Fragment key={entry.id}>
                    <tr
                      onClick={() => {
                        if (canExpand) {
                          setExpandedEntryId(isExpanded ? null : entry.id);
                        }
                        onSelect?.(entry);
                      }}
                      className={`border-b border-border cursor-pointer transition-colors ${isExpanded ? "bg-muted/35" : "hover:bg-muted/50"}`}
                    >
                      <td className="py-3 text-foreground">
                        <span className="hidden sm:inline">{entry.timestamp}</span>
                        <span className="inline sm:hidden text-xs">{getCompactTimestamp(entry.timestamp)}</span>
                      </td>
                      <td className="py-3">
                        <span
                          className="block max-w-[72px] truncate whitespace-nowrap px-1.5 py-0.5 text-[11px] font-mono font-medium text-foreground sm:max-w-none sm:px-2 sm:text-xs"
                          title={entry.model}
                        >
                          {entry.model}
                        </span>
                      </td>
                      <td className="py-3 text-muted-foreground font-mono text-xs">
                        <span
                          className="block max-w-[92px] truncate whitespace-nowrap sm:max-w-none"
                          title={getEndpointDisplay(entry.endpoint)}
                        >
                          {getEndpointDisplay(entry.endpoint)}
                        </span>
                      </td>
                      <td
                        className="py-3 text-right text-xs sm:text-sm font-semibold tabular-nums"
                        style={{ color: "rgb(0, 17, 44)" }}
                      >
                        {entry.score}%
                      </td>
                      <td className="py-3 text-center">
                        {entry.status === "pass" ? (
                          <CheckCircle2 className="w-4 h-4 text-success inline" />
                        ) : (
                          <XCircle className="w-4 h-4 text-error inline" />
                        )}
                      </td>
                    </tr>

                    {isExpanded && canExpand && (
                      <tr className="border-b border-border last:border-b-0">
                        <td colSpan={5} className="px-0 pt-0 pb-3">
                          <motion.div
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
                            className="w-full bg-[rgb(244,245,246)] px-4 py-3 sm:px-5"
                          >
                            <div className="flex items-end justify-between gap-4 pb-2.5">
                              <div className="min-w-0">
                                <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                                  {t("historyScore")}
                                </div>
                              </div>
                              <div
                                className="shrink-0 text-right text-2xl font-medium tabular-nums"
                                style={{ color: "rgb(0, 17, 44)" }}
                              >
                                {entry.score}%
                              </div>
                            </div>

                            {entry.checks && entry.checks.length > 0 && (
                              <div className="space-y-0">
                                {entry.checks.map((item) => {
                                  return (
                                    <div
                                      key={`${entry.id}-${item.name}`}
                                      className="flex items-center justify-between gap-3 border-b border-black/5 py-2 last:border-b-0"
                                    >
                                      <div className="min-w-0">
                                        <span className="text-xs text-foreground">{item.name}</span>
                                      </div>
                                      <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-xs text-foreground">
                                        {item.detail}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {(entry.latency !== undefined ||
                              entry.tps !== undefined ||
                              entry.inputTokens !== undefined ||
                              entry.outputTokens !== undefined) && (
                              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
                                {entry.latency !== undefined && (
                                  <div>
                                    <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                                      {t("metricLatency")}
                                    </div>
                                    <div className="mt-0.5 text-sm font-normal tabular-nums text-foreground">
                                      {entry.latency}ms
                                    </div>
                                  </div>
                                )}
                                {entry.tps !== undefined && (
                                  <div>
                                    <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                                      {t("metricTokensPerSecond")}
                                    </div>
                                    <div className="mt-0.5 text-sm font-normal tabular-nums text-foreground">
                                      {entry.tps}
                                    </div>
                                  </div>
                                )}
                                {entry.inputTokens !== undefined && (
                                  <div>
                                    <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                                      {t("metricInputTokens")}
                                    </div>
                                    <div className="mt-0.5 text-sm font-normal tabular-nums text-foreground">
                                      {entry.inputTokens}
                                    </div>
                                  </div>
                                )}
                                {entry.outputTokens !== undefined && (
                                  <div>
                                    <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                                      {t("metricOutputTokens")}
                                    </div>
                                    <div className="mt-0.5 text-sm font-normal tabular-nums text-foreground">
                                      {entry.outputTokens}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
