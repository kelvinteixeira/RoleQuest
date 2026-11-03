import { repositories } from "@/repositories";
import { AppError } from "@/lib/errors";
import { hasErrors, rules, validate } from "@/lib/validation";
import type { ID } from "@/types/common";
import type { PlayStyle, ProfileUpdate, UserProfile } from "@/types/user";
import type { SystemId } from "@/types/system";

export type ProfileForm = {
  displayName: string;
  username: string;
  bio: string;
  avatarColor: string;
  playStyle: PlayStyle;
  favoriteSystemIds: SystemId[];
};

export const USERNAME_PATTERN = /^[a-z0-9._]{3,20}$/;

export function validateProfile(values: ProfileForm) {
  return validate(values, {
    displayName: [rules.required("Informe um nome de exibição."), rules.minLength(2), rules.maxLength(40)],
    username: [
      rules.required("Escolha um nome de usuário."),
      rules.pattern(USERNAME_PATTERN, "Use de 3 a 20 caracteres: letras minúsculas, números, ponto ou _."),
    ],
    bio: [rules.maxLength(280)],
  });
}

export const profileService = {
  async get(userId: ID): Promise<UserProfile> {
    const profile = await repositories().users.getById(userId);
    if (!profile) throw new AppError("not_found");
    return profile;
  },

  /** Used by onboarding and Settings. Marks onboarding complete on first save. */
  async save(userId: ID, values: ProfileForm): Promise<UserProfile> {
    const errors = validateProfile(values);
    if (hasErrors(errors)) throw new AppError("validation", undefined, errors as Record<string, string>);

    const username = values.username.trim();
    if (await repositories().users.isUsernameTaken(username, userId)) {
      throw new AppError("validation", "Este nome de usuário já está em uso.", { username: "Este nome de usuário já está em uso." });
    }

    const patch: ProfileUpdate = {
      displayName: values.displayName.trim(),
      username,
      bio: values.bio.trim(),
      avatarColor: values.avatarColor,
      playStyle: values.playStyle,
      favoriteSystemIds: values.favoriteSystemIds,
      onboardingCompleted: true,
    };
    return repositories().users.update(userId, patch);
  },
};
