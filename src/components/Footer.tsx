import { Logo } from "@/components/Logo";
import { Github } from "lucide-react";
import { useI18n } from "@/i18n";

export function Footer() {
  const { t } = useI18n();

  return (
    <footer className="mt-12 border-t border-border">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Logo size={20} />
          <span className="text-sm text-muted-foreground font-medium">{t("footerBrand")}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <a
            href="https://github.com/zzsting88/relayAPI"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Github className="w-4 h-4" />
            <span>GitHub</span>
          </a>
          <a
            href="mailto:info@hvoy.ai"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors break-all sm:break-normal"
          >
            <span>{t("footerEmail")}: info@hvoy.ai</span>
          </a>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {t("footerRights")}
          </p>
        </div>
      </div>
    </footer>
  );
}
