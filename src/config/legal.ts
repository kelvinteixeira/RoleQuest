/**
 * Who runs this installation, for the terms and privacy pages. Unset values
 * show in brackets so a missing one is obvious before launch.
 * The texts are a starting point: have a lawyer review them for your business.
 */
export const legal = {
  entity: process.env.NEXT_PUBLIC_LEGAL_ENTITY || "[razão social]",
  document: process.env.NEXT_PUBLIC_LEGAL_DOCUMENT || "[CNPJ]",
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "[e-mail de contato]",
  city: process.env.NEXT_PUBLIC_LEGAL_CITY || "[cidade/UF]",
  updatedAt: "12 de novembro de 2026",
};
