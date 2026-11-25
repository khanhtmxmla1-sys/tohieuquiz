import {
  formatSystemDateTime,
  systemDateTimeLocalToIso,
  toSystemDateTimeLocal,
} from "../../../utils/dateTime";

export const ROUND_NUMBERS = [1, 2, 3, 4, 5, 6] as const;

export const splitIds = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export const createRequestId = (prefix: string) => {
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${suffix}`;
};

export const toDateTimeLocal = (value?: string | null) => {
  if (!value) return "";
  try {
    return toSystemDateTimeLocal(value);
  } catch {
    return "";
  }
};

export const toIsoDateTime = (value: string) => {
  if (!value) throw new Error("INVALID_DATE_TIME");
  try {
    return systemDateTimeLocalToIso(value);
  } catch {
    throw new Error("INVALID_DATE_TIME");
  }
};

export const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  return formatSystemDateTime(value, value);
};
