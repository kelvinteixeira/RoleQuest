/**
 * Domain errors. Services throw AppError; the UI maps `code` to a message
 * via `toUserMessage`. Keeps transport details (mock, Supabase) out of components.
 */
export type AppErrorCode =
  | "invalid_credentials"
  | "email_taken"
  | "not_found"
  | "forbidden"
  | "validation"
  | "unauthenticated"
  | "unknown";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly fieldErrors?: Record<string, string>;

  constructor(code: AppErrorCode, message?: string, fieldErrors?: Record<string, string>) {
    super(message ?? code);
    this.name = "AppError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

const MESSAGES: Record<AppErrorCode, string> = {
  invalid_credentials: "E-mail ou senha incorretos.",
  email_taken: "Já existe uma conta com este e-mail.",
  not_found: "Não encontramos o que você procurava.",
  forbidden: "Você não tem permissão para acessar este conteúdo.",
  validation: "Revise os campos destacados.",
  unauthenticated: "Sua sessão expirou. Entre novamente.",
  unknown: "Algo deu errado. Tente novamente em instantes.",
};

/** Field errors carried by a validation AppError (empty object otherwise). */
export function fieldErrorsOf(error: unknown): Record<string, string> {
  return error instanceof AppError && error.fieldErrors ? error.fieldErrors : {};
}

export function toUserMessage(error: unknown): string {
  if (error instanceof AppError) {
    // A custom message passed by the service wins over the generic one.
    return error.message !== error.code ? error.message : MESSAGES[error.code];
  }
  return MESSAGES.unknown;
}
