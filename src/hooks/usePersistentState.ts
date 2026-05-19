import { useCallback, useEffect, useRef, useState } from "react";

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
  writeDelayMs?: number;
};

type PendingPersistentWrite = {
  key: string;
  legacyKeySignature: string;
  serialized: string;
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
  const writeDelayMs = options.writeDelayMs ?? 100;
  const pendingWriteRef = useRef<PendingPersistentWrite | null>(null);
  const writeTimerRef = useRef<number | null>(null);

  const flushPendingWrite = useCallback(() => {
    if (writeTimerRef.current !== null) {
      window.clearTimeout(writeTimerRef.current);
      writeTimerRef.current = null;
    }

    const pending = pendingWriteRef.current;
    if (!pending) return;

    if (pending.warnSerializedLength && pending.serialized.length > pending.warnSerializedLength) {
      console.warn(
        `localStorage key "${pending.key}" is large (${pending.serialized.length} chars). Consider loading this file manually instead of persisting it.`
      );
    }

    localStorage.setItem(pending.key, pending.serialized);
    if (pending.legacyKeySignature) {
      pending.legacyKeySignature
        .split("\u0000")
        .filter(Boolean)
        .forEach((legacyKey) => localStorage.removeItem(legacyKey));
    }

    pendingWriteRef.current = null;
  }, []);

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
    pendingWriteRef.current = {
      key,
      legacyKeySignature,
      serialized: encodePersistentValue(state),
      warnSerializedLength: options.warnSerializedLength,
    };

    if (writeTimerRef.current !== null) {
      window.clearTimeout(writeTimerRef.current);
    }

    writeTimerRef.current = window.setTimeout(flushPendingWrite, writeDelayMs);
  }, [flushPendingWrite, key, legacyKeySignature, options.warnSerializedLength, state, writeDelayMs]);

  useEffect(() => {
    window.addEventListener("pagehide", flushPendingWrite);
    return () => {
      window.removeEventListener("pagehide", flushPendingWrite);
      flushPendingWrite();
    };
  }, [flushPendingWrite]);

  return [state, setState];
}
