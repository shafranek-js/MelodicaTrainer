import { describe, expect, it, vi } from "vitest";
import { stopAudioNodes } from "./audioPlayback";

type FakeAudioNode = {
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};

type FakeScheduledSource = FakeAudioNode & {
  stop: ReturnType<typeof vi.fn>;
};

const makeAudioNode = (): FakeAudioNode => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
});

describe("audio playback helpers", () => {
  it("stops, disconnects, and clears active source nodes", () => {
    const sourceNodes: FakeScheduledSource[] = [
      { ...makeAudioNode(), stop: vi.fn() },
      { ...makeAudioNode(), stop: vi.fn() },
    ];
    const activeAudioNodes = new Set(
      sourceNodes.map((node) => node as unknown as AudioScheduledSourceNode)
    );

    stopAudioNodes(activeAudioNodes);

    expect(activeAudioNodes.size).toBe(0);
    expect(sourceNodes[0].stop).toHaveBeenCalledTimes(1);
    expect(sourceNodes[0].disconnect).toHaveBeenCalledTimes(1);
    expect(sourceNodes[1].stop).toHaveBeenCalledTimes(1);
    expect(sourceNodes[1].disconnect).toHaveBeenCalledTimes(1);
  });
});
