import { Avatar, ResourceBar } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { SystemTag } from "@/features/systems/components/system-identity";
import type { CharacterCardModel } from "@/services/collection.service";

export function CharacterCard({ model, className }: { model: CharacterCardModel; className?: string }) {
  const { character, system, campaignName } = model;
  return (
    <article className={cn("surface-card flex flex-col gap-4 p-4", className)}>
      <div className="flex items-start gap-3">
        <Avatar name={character.name} color={character.portraitColor} src={character.avatarUrl} size="lg" className="rounded-xl" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-base font-semibold">{character.name}</h3>
          <p className="truncate text-xs text-fg-subtle">{character.concept}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <SystemTag theme={system.theme} label={system.shortName} />
            {character.level !== null && (
              <span className="rounded-md bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] text-fg-muted">
                {system.progression.label} {character.level}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {character.resources.map((r) => (
          <ResourceBar key={r.key} label={r.label} value={r.current} max={r.max} color={r.color} />
        ))}
      </div>
      <p className="mt-auto truncate border-t border-line pt-3 text-xs text-fg-subtle">
        {campaignName ? (
          <>
            Em <span className="text-fg-muted">{campaignName}</span>
          </>
        ) : (
          "Sem campanha · disponível para novas mesas"
        )}
      </p>
    </article>
  );
}
