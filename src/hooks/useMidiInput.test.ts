import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMidiInput } from "./useMidiInput";
import type { MidiInputState } from "./useMidiInput";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type MockMidiInput = {
  id: string;
  onmidimessage: MIDIInput["onmidimessage"];
  state: MIDIPortDeviceState;
};

type MockMidiAccess = {
  inputs: Map<string, MIDIInput>;
  onstatechange: MIDIAccess["onstatechange"];
};

let latestState: MidiInputState | null = null;

const TestComponent = ({
  onNoteOff,
  onNoteOn,
}: {
  onNoteOff?: (midi: number) => void;
  onNoteOn?: (midi: number, velocity: number) => void;
}) => {
  latestState = useMidiInput({ onNoteOff, onNoteOn });
  return null;
};

const createInput = (id: string): MockMidiInput => ({
  id,
  onmidimessage: null,
  state: "connected",
});

const createAccess = (inputs: MockMidiInput[]): MockMidiAccess => ({
  inputs: new Map(inputs.map((input) => [input.id, input as unknown as MIDIInput])),
  onstatechange: null,
});

const dispatchMidi = (input: MockMidiInput, data: number[]) => {
  input.onmidimessage?.call(
    input as unknown as MIDIInput,
    { data: new Uint8Array(data) } as MIDIMessageEvent,
  );
};

const dispatchStateChange = (access: MockMidiAccess) => {
  access.onstatechange?.call(
    access as unknown as MIDIAccess,
    {} as MIDIConnectionEvent,
  );
};

const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("useMidiInput", () => {
  let container: HTMLDivElement;
  let originalMidiDescriptor: PropertyDescriptor | undefined;
  let root: Root | null;

  beforeEach(() => {
    latestState = null;
    root = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    originalMidiDescriptor = Object.getOwnPropertyDescriptor(navigator, "requestMIDIAccess");
  });

  afterEach(async () => {
    if (root) {
      await act(async () => root?.unmount());
    }
    if (originalMidiDescriptor) {
      Object.defineProperty(navigator, "requestMIDIAccess", originalMidiDescriptor);
    } else {
      Reflect.deleteProperty(navigator, "requestMIDIAccess");
    }
    container.remove();
    vi.restoreAllMocks();
  });

  const mockRequestAccess = (request: () => Promise<MIDIAccess>) => {
    Object.defineProperty(navigator, "requestMIDIAccess", {
      configurable: true,
      value: vi.fn(request),
    });
  };

  const renderHook = async (
    onNoteOn = vi.fn<(midi: number, velocity: number) => void>(),
    onNoteOff = vi.fn<(midi: number) => void>(),
  ) => {
    root = createRoot(container);
    await act(async () => {
      root?.render(createElement(TestComponent, { onNoteOff, onNoteOn }));
      await flushPromises();
    });
    return { onNoteOff, onNoteOn };
  };

  it("handles note-on and both note-off encodings", async () => {
    const input = createInput("keyboard-1");
    const access = createAccess([input]);
    mockRequestAccess(() => Promise.resolve(access as unknown as MIDIAccess));
    const { onNoteOff, onNoteOn } = await renderHook();

    await act(async () => dispatchMidi(input, [0x90, 60, 91]));
    expect(latestState?.activeNotes.has(60)).toBe(true);
    expect(onNoteOn).toHaveBeenCalledWith(60, 91);

    await act(async () => dispatchMidi(input, [0x90, 60, 0]));
    expect(latestState?.activeNotes.has(60)).toBe(false);
    expect(onNoteOff).toHaveBeenCalledWith(60);

    await act(async () => dispatchMidi(input, [0x91, 62, 80]));
    await act(async () => dispatchMidi(input, [0x81, 62, 0]));
    expect(latestState?.activeNotes.has(62)).toBe(false);
  });

  it("keeps a shared pitch active until every input releases it", async () => {
    const first = createInput("keyboard-1");
    const second = createInput("keyboard-2");
    const access = createAccess([first, second]);
    mockRequestAccess(() => Promise.resolve(access as unknown as MIDIAccess));
    const { onNoteOff, onNoteOn } = await renderHook();

    await act(async () => dispatchMidi(first, [0x90, 60, 100]));
    await act(async () => dispatchMidi(second, [0x90, 60, 110]));
    expect(onNoteOn).toHaveBeenCalledTimes(1);

    await act(async () => dispatchMidi(first, [0x80, 60, 0]));
    expect(latestState?.activeNotes.has(60)).toBe(true);
    expect(onNoteOff).not.toHaveBeenCalled();

    await act(async () => dispatchMidi(second, [0x80, 60, 0]));
    expect(latestState?.activeNotes.has(60)).toBe(false);
    expect(onNoteOff).toHaveBeenCalledOnce();
  });

  it("releases held notes when a device disconnects", async () => {
    const input = createInput("keyboard-1");
    const access = createAccess([input]);
    mockRequestAccess(() => Promise.resolve(access as unknown as MIDIAccess));
    const { onNoteOff } = await renderHook();

    await act(async () => dispatchMidi(input, [0x90, 64, 100]));
    input.state = "disconnected";
    access.inputs.clear();
    await act(async () => dispatchStateChange(access));

    expect(latestState?.connectedInputCount).toBe(0);
    expect(latestState?.activeNotes.size).toBe(0);
    expect(onNoteOff).toHaveBeenCalledWith(64);
    expect(input.onmidimessage).toBeNull();
  });

  it("does not attach inputs after unmount while access is pending", async () => {
    const input = createInput("keyboard-1");
    const access = createAccess([input]);
    const pending: { resolve?: (access: MIDIAccess) => void } = {};
    mockRequestAccess(() => new Promise((resolve) => { pending.resolve = resolve; }));
    await renderHook();

    await act(async () => root?.unmount());
    root = null;
    pending.resolve?.(access as unknown as MIDIAccess);
    await act(flushPromises);

    expect(input.onmidimessage).toBeNull();
    expect(access.onstatechange).toBeNull();
  });

  it("reports unsupported and denied access states", async () => {
    Reflect.deleteProperty(navigator, "requestMIDIAccess");
    await renderHook();
    expect(latestState?.accessState).toBe("unsupported");

    await act(async () => root?.unmount());
    root = null;
    mockRequestAccess(() => Promise.reject(new Error("Permission denied")));
    await renderHook();
    expect(latestState?.accessState).toBe("denied");
    expect(latestState?.error).toBe("Permission denied");
  });
});
