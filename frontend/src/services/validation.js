const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_PATTERN = /^[\p{L}\p{M}]+(?:[ .'-][\p{L}\p{M}]+)*$/u;

export function normalizeName(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export function validateName(value) {
  const name = normalizeName(value);
  if (name.length < 2 || name.length > 80) return "Name must be between 2 and 80 characters.";
  if (!NAME_PATTERN.test(name)) return "Use letters and separate name parts with spaces, hyphens, apostrophes, or periods.";
  return "";
}

export function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function validateEmail(value) {
  const email = normalizeEmail(value);
  if (!email || !EMAIL_PATTERN.test(email)) return "Enter a valid email address.";
  return "";
}

export function validatePassword(value) {
  if (typeof value !== "string" || value.length < 8 || value.length > 128) {
    return "Password must be between 8 and 128 characters.";
  }
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/[0-9]/.test(value) || !/[^A-Za-z0-9]/.test(value)) {
    return "Use uppercase and lowercase letters, a number, and a symbol.";
  }
  return "";
}

export function validateOtp(value) {
  return typeof value === "string" && /^\d{6}$/.test(value)
    ? ""
    : "Enter the 6-digit verification code.";
}
