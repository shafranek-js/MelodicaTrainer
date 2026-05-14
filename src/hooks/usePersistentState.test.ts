import { describe, expect, it } from "vitest";
import { decodePersistentValue, encodePersistentValue } from "./usePersistentState";

describe("persistent state serialization", () => {
    it("round-trips versioned primitive values", () => {
        expect(decodePersistentValue(encodePersistentValue(42))).toBe(42);
        expect(decodePersistentValue(encodePersistentValue(null))).toBeNull();
    });

    it("keeps backward compatibility with legacy raw JSON values", () => {
        expect(decodePersistentValue(JSON.stringify({ enabled: true }))).toEqual({ enabled: true });
    });

    it("keeps backward compatibility with legacy Uint8Array values", () => {
        const legacy = JSON.stringify({ __type: "Uint8Array", data: btoa("\x01\x02\xff") });

        expect(Array.from(decodePersistentValue(legacy) as Uint8Array)).toEqual([1, 2, 255]);
    });

    it("round-trips Uint8Array values inside the versioned envelope", () => {
        const value = new Uint8Array([0, 127, 255]);
        const decoded = decodePersistentValue(encodePersistentValue(value));

        expect(decoded).toBeInstanceOf(Uint8Array);
        expect(Array.from(decoded as Uint8Array)).toEqual([0, 127, 255]);
    });
});
