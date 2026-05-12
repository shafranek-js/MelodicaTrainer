import { useState, useEffect } from "react";

const uint8ArrayToBase64 = (arr: Uint8Array) => btoa(String.fromCharCode(...arr));
const base64ToUint8Array = (str: string) => new Uint8Array(atob(str).split("").map(c => c.charCodeAt(0)));

export function usePersistentState<T>(key: string, defaultValue: T): [T, (value: T) => void] {
  const [state, setState] = useState<T>(() => {
    const saved = localStorage.getItem(key);
    if (saved !== null) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && parsed.__type === 'Uint8Array') {
            return base64ToUint8Array(parsed.data) as unknown as T;
        }
        return parsed;
      } catch (e) {
        console.error(`Error parsing localStorage key "${key}":`, e);
      }
    }
    return defaultValue;
  });

  useEffect(() => {
    let toSave: any = state;
    if (state instanceof Uint8Array) {
        toSave = { __type: 'Uint8Array', data: uint8ArrayToBase64(state) };
    }
    localStorage.setItem(key, JSON.stringify(toSave));
  }, [key, state]);

  return [state, setState];
}
