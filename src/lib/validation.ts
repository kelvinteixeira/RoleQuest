/**
 * Minimal, dependency-free validation. Each rule returns an error message or null.
 * `validate` runs a schema of rules and returns a field → message map.
 */
export type Rule<T> = (value: T) => string | null;

export const rules = {
  required:
    (message = "Campo obrigatório."): Rule<string> =>
    (v) =>
      v.trim().length === 0 ? message : null,
  email:
    (message = "Informe um e-mail válido."): Rule<string> =>
    (v) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? null : message,
  minLength:
    (min: number, message?: string): Rule<string> =>
    (v) =>
      v.trim().length < min ? (message ?? `Use pelo menos ${min} caracteres.`) : null,
  maxLength:
    (max: number, message?: string): Rule<string> =>
    (v) =>
      v.trim().length > max ? (message ?? `Use no máximo ${max} caracteres.`) : null,
  pattern:
    (regex: RegExp, message: string): Rule<string> =>
    (v) =>
      regex.test(v) ? null : message,
};

export type Schema<T> = { [K in keyof T]?: Rule<T[K]>[] };
export type FieldErrors<T> = Partial<Record<keyof T, string>>;

export function validate<T>(values: T, schema: Schema<T>): FieldErrors<T> {
  const errors: FieldErrors<T> = {};
  for (const key in schema) {
    for (const rule of schema[key] ?? []) {
      const message = rule(values[key]);
      if (message) {
        errors[key] = message;
        break;
      }
    }
  }
  return errors;
}

export function hasErrors<T>(errors: FieldErrors<T>): boolean {
  return Object.values(errors).some(Boolean);
}
