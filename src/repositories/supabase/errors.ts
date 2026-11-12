import { AppError } from "@/lib/errors";

type DbError = { code?: string; message?: string; status?: number; name?: string } | null | undefined;

/**
 * Translates Postgres / PostgREST / Auth errors into the app's AppError codes,
 * so services and components handle Supabase exactly like the mock.
 */
export function toAppError(error: DbError, fallback = "Algo deu errado ao falar com o servidor."): AppError {
  if (!error) return new AppError("unknown", fallback);
  const message = error.message ?? fallback;
  switch (error.code) {
    case "42501": // insufficient_privilege: RLS refused, or a guard trigger
      return new AppError("forbidden", /row-level security/i.test(message) ? "Você não tem permissão para isso." : message);
    case "P0002": // no_data_found raised by our functions
      return new AppError("not_found", message);
    case "P0001": // raise_exception from our guards (e.g. the free plan's campaign limit): the message is for the person
      return new AppError("validation", message);
    case "PGRST116": // .single() found no row
      return new AppError("not_found", "Não encontrado.");
    case "22023": // invalid_parameter_value raised by our functions
      return new AppError("validation", message);
    case "23514": // check_violation: a length or format limit of the schema
      return new AppError("validation", "Algum campo passou do limite permitido.");
    case "23503": // foreign_key_violation
      return new AppError("validation", "Algo que este registro usa não existe mais.");
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return new AppError("validation", "Muitas tentativas seguidas. Espere um pouco e tente de novo.");
    case "23505": // unique_violation
      return new AppError("validation", "Já existe um registro com esses dados.");
    case "invalid_credentials":
      return new AppError("invalid_credentials");
    case "user_already_exists":
    case "email_exists":
      return new AppError("email_taken", undefined, { email: "Já existe uma conta com este e-mail." });
    case "email_not_confirmed":
      return new AppError("validation", "Confirme seu e-mail pelo link que enviamos antes de entrar.");
    case "weak_password":
      return new AppError("validation", "Senha fraca: use mais caracteres ou misture letras e números.", { password: "Senha fraca." });
  }
  if (error.status === 401) return new AppError("unauthenticated");
  if (error.status === 429) return new AppError("validation", "Muitas tentativas seguidas. Espere um pouco e tente de novo.");
  return new AppError("unknown", message);
}

/** Throws the translated error when a Supabase call failed; returns the data otherwise (lists, .single(), writes). */
export function unwrap<T>(result: { data: T | null; error: DbError }): T {
  if (result.error) throw toAppError(result.error);
  return result.data as T;
}

/** For .maybeSingle(): null means "no such row" (or not visible to this user). */
export function unwrapMaybe<T>(result: { data: T | null; error: DbError }): T | null {
  if (result.error) throw toAppError(result.error);
  return result.data;
}
