/**
 * Operator details (company name, address, registration number, contact emails).
 * Filled from environment variables so the real details never have to be hard-coded:
 * COMPANY_NAME, COMPANY_ADDRESS, COMPANY_REG_NO, COMPANY_VAT, COMPANY_COUNTRY,
 * SUPPORT_EMAIL, PRIVACY_EMAIL, COPYRIGHT_EMAIL.
 * Until they are set, legal texts keep their [bracket] placeholders and the footer shows nothing.
 */
export type Company = {
  name: string;
  address: string;
  regNo: string;
  vat: string;
  country: string;
  support: string;
  privacy: string;
  copyright: string;
};

export function getCompany(env: Record<string, string | undefined> = process.env): Company {
  const v = (k: string) => (env[k] ?? "").trim();
  const support = v("SUPPORT_EMAIL");
  return {
    name: v("COMPANY_NAME"),
    address: v("COMPANY_ADDRESS"),
    regNo: v("COMPANY_REG_NO"),
    vat: v("COMPANY_VAT"),
    country: v("COMPANY_COUNTRY"),
    support,
    privacy: v("PRIVACY_EMAIL") || support,
    copyright: v("COPYRIGHT_EMAIL") || support,
  };
}

/** True when the minimum legally required details (name, address, registration number, contact email) are set. */
export function companyComplete(c: Company = getCompany()) {
  return !!(c.name && c.address && c.regNo && c.support);
}

/** Replaces [bracket] placeholders in a legal text with the operator's details (only those that are set). */
export function fillCompany(text: string, c: Company = getCompany()): string {
  const full = [c.name, c.address, c.regNo && `reg. no. ${c.regNo}`].filter(Boolean).join(", ");
  const short = [c.name, c.address].filter(Boolean).join(", ");
  const rules: [RegExp, string][] = [
    [/\[(Company name, address, registration number|название компании, адрес, регистрационный номер)\]/g, companyComplete(c) ? full : ""],
    [/\[(Company name, address|название компании, адрес)\]/g, c.name && c.address ? short : ""],
    [/\[(support email|email поддержки)\]/g, c.support],
    [/\[(privacy email|email по вопросам данных)\]/g, c.privacy],
    [/\[(copyright email|email для правообладателей)\]/g, c.copyright],
    [/\[(country|страна)\]/g, c.country],
  ];
  let out = text;
  for (const [re, value] of rules) if (value) out = out.replace(re, value);
  return out;
}
