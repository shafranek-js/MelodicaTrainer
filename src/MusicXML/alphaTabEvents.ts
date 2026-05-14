import type * as alphaTab from "@coderline/alphatab";

export const onAlphaTabEvent = (
    event: alphaTab.IEventEmitter | undefined,
    callback: () => void
) => {
    event?.on(callback);
};

export const onAlphaTabEventOf = <T,>(
    event: alphaTab.IEventEmitterOfT<T> | undefined,
    callback: (args: T) => void
) => {
    event?.on(callback);
};
