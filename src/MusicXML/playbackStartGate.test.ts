import { describe, expect, it } from "vitest";
import { createPlaybackStartGate } from "./playbackStartGate";

describe("createPlaybackStartGate", () => {
  it("allows one async start at a time", async () => {
    const gate = createPlaybackStartGate();
    let releaseStart = () => {};
    let starts = 0;

    const firstRun = gate.run(
      () =>
        new Promise<void>((resolve) => {
          starts += 1;
          releaseStart = resolve;
        }),
    );
    const secondRun = gate.run(async () => {
      starts += 1;
    });

    await expect(secondRun).resolves.toBe(false);
    expect(starts).toBe(1);
    expect(gate.isPending()).toBe(true);

    releaseStart();

    await expect(firstRun).resolves.toBe(true);
    expect(gate.isPending()).toBe(false);
  });

  it("reopens after a failed start", async () => {
    const gate = createPlaybackStartGate();

    await expect(
      gate.run(async () => {
        throw new Error("init failed");
      }),
    ).rejects.toThrow("init failed");

    await expect(gate.run(async () => {})).resolves.toBe(true);
  });
});
