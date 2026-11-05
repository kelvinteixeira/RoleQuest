import { repositories } from "@/repositories";
import { AppError } from "@/lib/errors";
import { hasErrors, rules, validate } from "@/lib/validation";
import type { AuthSession, SignUpInput, UserProfile } from "@/types/user";

export type AuthResult = { session: AuthSession; profile: UserProfile };

export const PASSWORD_MIN_LENGTH = 8;

export function validateSignIn(values: { email: string; password: string }) {
  return validate(values, {
    email: [rules.required("Informe seu e-mail."), rules.email()],
    password: [rules.required("Informe sua senha.")],
  });
}

export function validateSignUp(values: SignUpInput & { confirmPassword: string }) {
  const errors = validate(values, {
    displayName: [rules.required("Como devemos te chamar?"), rules.minLength(2), rules.maxLength(40)],
    email: [rules.required("Informe seu e-mail."), rules.email()],
    password: [rules.required("Crie uma senha."), rules.minLength(PASSWORD_MIN_LENGTH)],
    confirmPassword: [rules.required("Confirme sua senha.")],
  });
  if (!errors.confirmPassword && values.password !== values.confirmPassword) {
    errors.confirmPassword = "As senhas não coincidem.";
  }
  return errors;
}

async function loadProfile(session: AuthSession): Promise<AuthResult> {
  const profile = await repositories().users.getById(session.userId);
  if (!profile) throw new AppError("not_found", "Perfil não encontrado para esta conta.");
  return { session, profile };
}

export const authService = {
  async signIn(email: string, password: string): Promise<AuthResult> {
    const errors = validateSignIn({ email, password });
    if (hasErrors(errors)) throw new AppError("validation", undefined, errors as Record<string, string>);
    const session = await repositories().auth.signIn(email, password);
    return loadProfile(session);
  },

  async signUp(input: SignUpInput & { confirmPassword: string }): Promise<AuthResult> {
    const errors = validateSignUp(input);
    if (hasErrors(errors)) throw new AppError("validation", undefined, errors as Record<string, string>);
    const session = await repositories().auth.signUp({
      email: input.email,
      password: input.password,
      displayName: input.displayName,
    });
    return loadProfile(session);
  },

  async requestPasswordReset(email: string): Promise<void> {
    const errors = validate({ email }, { email: [rules.required("Informe seu e-mail."), rules.email()] });
    if (hasErrors(errors)) throw new AppError("validation", errors.email, errors as Record<string, string>);
    await repositories().auth.requestPasswordReset(email);
  },

  /** From the reset link: validates and saves the new password, then signs in. */
  async completePasswordReset(values: { password: string; confirmPassword: string }): Promise<AuthResult> {
    const errors = validate(values, {
      password: [rules.required("Crie uma senha."), rules.minLength(PASSWORD_MIN_LENGTH)],
      confirmPassword: [rules.required("Confirme sua senha.")],
    });
    if (!errors.confirmPassword && values.password !== values.confirmPassword) errors.confirmPassword = "As senhas não coincidem.";
    if (hasErrors(errors)) throw new AppError("validation", undefined, errors as Record<string, string>);
    const session = await repositories().auth.updatePassword(values.password);
    return loadProfile(session);
  },

  async signOut(): Promise<void> {
    await repositories().auth.signOut();
  },

  /** On app load: keeps the session only if the backend still accepts it (Supabase refreshes it). */
  async resume(stored: AuthSession | null): Promise<AuthSession | null> {
    try {
      return await repositories().auth.resume(stored);
    } catch {
      return null;
    }
  },

  isSessionValid(session: AuthSession | null): session is AuthSession {
    return !!session && new Date(session.expiresAt).getTime() > Date.now();
  },
};
