import { useState, useEffect } from "react";

const STORAGE_ENVELOPE_TYPE = "MelodicaTrainerPersistentState";
const STORAGE_VERSION = 1;
const UINT8_ARRAY_TYPE = "Uint8Array";
const BYTE_CHUNK_SIZE = 0x8000;

type EncodedUint8Array = {
  __type: typeof UINT8_ARRAY_TYPE;
  data: string;
};

type PersistentStateEnvelope = {
  __type: typeof STORAGE_ENVELOPE_TYPE;
  version: typeof STORAGE_VERSION;
  value: unknown;
};

type PersistentStateOptions<T> = {
  legacyKeys?: readonly string[];
  sanitize?: (value: unknown) => T | undefined;
  warnSerializedLength?: number;
};

const uint8ArrayToBase64 = (arr: Uint8Array) => {
  let binary = "";
  for (let index = 0; index < arr.length; index += BYTE_CHUNK_SIZE) {
    binary += String.fromCharCode(...arr.subarray(index, index + BYTE_CHUNK_SIZE));
  }
  return btoa(binary);
};

const base64ToUint8Array = (str: string) => new Uint8Array(atob(str).split("").map(c => c.charCodeAt(0)));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isEncodedUint8Array = (value: unknown): value is EncodedUint8Array =>
  isRecord(value) && value.__type === UINT8_ARRAY_TYPE && typeof value.data === "string";

const isPersistentEnvelope = (value: unknown): value is PersistentStateEnvelope =>
  isRecord(value) &&
  value.__type === STORAGE_ENVELOPE_TYPE &&
  value.version === STORAGE_VERSION &&
  "value" in value;

const encodeSpecialValue = (value: unknown): unknown => {
  if (value instanceof Uint8Array) {
    return { __type: UINT8_ARRAY_TYPE, data: uint8ArrayToBase64(value) };
  }
  return value;
};

const decodeSpecialValue = (value: unknown): unknown => {
  if (isEncodedUint8Array(value)) {
    return base64ToUint8Array(value.data);
  }
  return value;
};

export const encodePersistentValue = (value: unknown) =>
  JSON.stringify({
    __type: STORAGE_ENVELOPE_TYPE,
    version: STORAGE_VERSION,
    value: encodeSpecialValue(value),
  });

export const decodePersistentValue = (saved: string): unknown => {
  const parsed = JSON.parse(saved);
  if (isPersistentEnvelope(parsed)) {
    return decodeSpecialValue(parsed.value);
  }
  return decodeSpecialValue(parsed);
};

export function usePersistentState<T>(
  key: string,
  defaultValue: T,
  options: PersistentStateOptions<T> = {}
): [T, (value: T) => void] {
  const legacyKeySignature = options.legacyKeys?.join("\u0000") ?? "";

  const [state, setState] = useState<T>(() => {
    const keysToTry = [key, ...(options.legacyKeys ?? [])];

    for (const storageKey of keysToTry) {
      const saved = localStorage.getItem(storageKey);
      if (saved === null) continue;

      try {
        const decoded = decodePersistentValue(saved);
        if (options.sanitize) {
          const sanitized = options.sanitize(decoded);
          if (sanitized !== undefined) return sanitized;
        } else {
          return decoded as T;
        }
      } catch (e) {
        console.error(`Error parsing localStorage key "${storageKey}":`, e);
      }
    }

    return defaultValue;
  });

  useEffect(() => {
    const serialized = encodePersistentValue(state);
    if (options.warnSerializedLength && serialized.length > options.warnSerializedLength) {
      console.warn(
        `localStorage key "${key}" is large (${serialized.length} chars). Consider loading this file manually instead of persisting it.`
      );
    }
    localStorage.setItem(key, serialized);
    if (legacyKeySignature) {
      legacyKeySignature
        .split("\u0000")
        .filter(Boolean)
        .forEach((legacyKey) => localStorage.removeItem(legacyKey));
    }
  }, [key, legacyKeySignature, options.warnSerializedLength, state]);

  return [state, setState];
}
