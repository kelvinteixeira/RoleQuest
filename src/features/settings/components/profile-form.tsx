"use client";

import { useState, type FormEvent } from "react";
import { Check, Crown, Swords, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { Avatar } from "@/components/ui/primitives";
import { AVATAR_COLORS } from "@/constants/campaign";
import { cn } from "@/lib/cn";
import { fieldErrorsOf, toUserMessage } from "@/lib/errors";
import { hasErrors } from "@/lib/validation";
import { profileService, validateProfile, type ProfileForm as ProfileValues } from "@/services/profile.service";
import { systemService } from "@/services/system.service";
import { SystemGlyphIcon, systemStyle } from "@/features/systems/components/system-identity";
import { FormAlert } from "@/features/authentication/components/form-alert";
import type { PlayStyle, UserProfile } from "@/types/user";
import type { SystemId } from "@/types/system";

const PLAY_STYLES: { value: PlayStyle; label: string; description: string; icon: typeof Crown }[] = [
  { value: "game_master", label: "Mestre", description: "Conduzo as histórias", icon: Crown },
  { value: "player", label: "Jogador", description: "Vivo os personagens", icon: Swords },
  { value: "both", label: "Os dois", description: "Depende da mesa", icon: Users },
];

const MAX_FAVORITES = 5;

/** Profile editor shared by onboarding and Settings. */
export function ProfileForm({
  profile,
  submitLabel,
  onSaved,
}: {
  profile: UserProfile;
  submitLabel: string;
  onSaved: (profile: UserProfile) => void;
}) {
  const [values, setValues] = useState<ProfileValues>({
    displayName: profile.displayName,
    username: profile.username,
    bio: profile.bio,
    avatarColor: profile.avatarColor,
    playStyle: profile.playStyle,
    favoriteSystemIds: profile.favoriteSystemIds,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const systems = systemService.listBuiltIn();

  const patch = (p: Partial<ProfileValues>) => setValues((v) => ({ ...v, ...p }));

  function toggleSystem(id: SystemId) {
    const has = values.favoriteSystemIds.includes(id);
    if (!has && values.favoriteSystemIds.length >= MAX_FAVORITES) return;
    patch({ favoriteSystemIds: has ? values.favoriteSystemIds.filter((s) => s !== id) : [...values.favoriteSystemIds, id] });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const fieldErrors = validateProfile(values);
    setErrors(fieldErrors as Record<string, string>);
    if (hasErrors(fieldErrors)) return;
    setPending(true);
    try {
      onSaved(await profileService.save(profile.id, values));
    } catch (error) {
      setErrors(fieldErrorsOf(error));
      setFormError(toUserMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-7" noValidate>
      {formError && <FormAlert>{formError}</FormAlert>}

      <section className="flex items-center gap-4">
        <Avatar name={values.displayName || "?"} color={values.avatarColor} size="lg" />
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-fg-muted">Cor do avatar</span>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Cor do avatar">
            {AVATAR_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={values.avatarColor === color}
                aria-label={`Cor ${color}`}
                onClick={() => patch({ avatarColor: color })}
                className={cn(
                  "flex size-6 items-center justify-center rounded-full ring-offset-2 ring-offset-canvas transition",
                  values.avatarColor === color && "ring-2 ring-fg/70",
                )}
                style={{ background: color }}
              >
                {values.avatarColor === color && <Check className="size-3 text-white" />}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-fg-subtle">Upload de imagem chega com o Supabase Storage (Fase 7).</span>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Nome de exibição" value={values.displayName} onChange={(e) => patch({ displayName: e.target.value })} error={errors.displayName} />
        <Input
          label="Nome de usuário"
          value={values.username}
          onChange={(e) => patch({ username: e.target.value.toLowerCase() })}
          error={errors.username}
          hint="Usado em convites: @usuario"
          leadingIcon={<span className="text-sm">@</span>}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-xs font-medium text-fg-muted">Como você costuma jogar?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {PLAY_STYLES.map(({ value, label, description, icon: Icon }) => {
            const active = values.playStyle === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => patch({ playStyle: value })}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                  active ? "border-accent/50 bg-accent/8" : "border-line bg-surface hover:border-line-strong",
                )}
              >
                <Icon className={cn("mt-0.5 size-4", active ? "text-accent" : "text-fg-subtle")} />
                <span>
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-xs text-fg-subtle">{description}</span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-fg-subtle">É só uma preferência: seu papel é definido em cada campanha.</p>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 flex w-full items-baseline justify-between text-xs font-medium text-fg-muted">
          <span>Sistemas favoritos</span>
          <span className="font-mono text-[11px] text-fg-subtle">
            {values.favoriteSystemIds.length}/{MAX_FAVORITES}
          </span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {systems.map((s) => {
            const active = values.favoriteSystemIds.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggleSystem(s.id)}
                style={systemStyle(s.theme)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                  active ? "border-system/50 bg-system/12 text-system" : "border-line text-fg-muted hover:border-line-strong hover:text-fg",
                )}
              >
                <SystemGlyphIcon glyph={s.theme.glyph} className="size-3.5" />
                {s.shortName}
              </button>
            );
          })}
        </div>
      </fieldset>

      <Textarea
        label="Sobre você"
        optional
        rows={3}
        placeholder="Que tipo de história você gosta de contar ou viver?"
        value={values.bio}
        onChange={(e) => patch({ bio: e.target.value })}
        error={errors.bio}
        hint={`${values.bio.length}/280`}
      />

      <Button type="submit" size="lg" loading={pending} className="self-start">
        {submitLabel}
      </Button>
    </form>
  );
}
