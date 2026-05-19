import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { afterEach, beforeEach, vi } from "vitest";
import { decodePersistentValue, encodePersistentValue } from "./usePersistentState";
import { usePersistentState } from "./usePersistentState";

const renderPersistentProbe = <T,>(
    key: string,
    defaultValue: T,
    options?: Parameters<typeof usePersistentState<T>>[2],
) => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    let setValue: ((value: T) => void) | null = null;

    const Probe = () => {
        const [value, setter] = usePersistentState(key, defaultValue, options);
        setValue = setter;
        return createElement("div", { "data-value": String(value) });
    };

    act(() => {
        root.render(createElement(Probe));
    });

    return {
        container,
        root,
        setValue: (value: T) => {
            if (!setValue) throw new Error("Persistent probe setter was not initialized");
            act(() => setValue?.(value));
        },
        unmount: () => {
            act(() => root.unmount());
            container.remove();
        },
    };
};

beforeEach(() => {
    localStorage.clear();
});

afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
});

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

describe("usePersistentState writes", () => {
    it("debounces localStorage writes", () => {
        vi.useFakeTimers();
        const probe = renderPersistentProbe("debounced-key", "initial");

        expect(localStorage.getItem("debounced-key")).toBeNull();

        probe.setValue("updated");
        expect(localStorage.getItem("debounced-key")).toBeNull();

        act(() => {
            vi.advanceTimersByTime(99);
        });
        expect(localStorage.getItem("debounced-key")).toBeNull();

        act(() => {
            vi.advanceTimersByTime(1);
        });
        expect(decodePersistentValue(localStorage.getItem("debounced-key") ?? "")).toBe("updated");

        probe.unmount();
    });

    it("flushes the pending write on unmount", () => {
        vi.useFakeTimers();
        const probe = renderPersistentProbe("unmount-key", "initial");

        probe.setValue("latest");
        probe.unmount();

        expect(decodePersistentValue(localStorage.getItem("unmount-key") ?? "")).toBe("latest");
    });

    it("flushes the pending write on pagehide", () => {
        vi.useFakeTimers();
        const probe = renderPersistentProbe("pagehide-key", "initial");

        probe.setValue("hidden");
        act(() => {
            window.dispatchEvent(new PageTransitionEvent("pagehide"));
        });

        expect(decodePersistentValue(localStorage.getItem("pagehide-key") ?? "")).toBe("hidden");

        probe.unmount();
    });

    it("removes legacy keys when the debounced write flushes", () => {
        vi.useFakeTimers();
        localStorage.setItem("legacy-key", encodePersistentValue("old"));
        const probe = renderPersistentProbe("modern-key", "new", {
            legacyKeys: ["legacy-key"],
        });
        probe.setValue("new");

        act(() => {
            vi.advanceTimersByTime(100);
        });

        expect(decodePersistentValue(localStorage.getItem("modern-key") ?? "")).toBe("new");
        expect(localStorage.getItem("legacy-key")).toBeNull();

        probe.unmount();
    });

    it("flushes Uint8Array values without changing serialization format", () => {
        vi.useFakeTimers();
        const probe = renderPersistentProbe("bytes-key", new Uint8Array([1, 2, 255]));

        act(() => {
            vi.advanceTimersByTime(100);
        });

        const decoded = decodePersistentValue(localStorage.getItem("bytes-key") ?? "");
        expect(decoded).toBeInstanceOf(Uint8Array);
        expect(Array.from(decoded as Uint8Array)).toEqual([1, 2, 255]);

        probe.unmount();
    });
});
