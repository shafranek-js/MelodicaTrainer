export const createPlaybackStartGate = () => {
  let pending = false;

  return {
    isPending: () => pending,
    run: async (startPlayback: () => Promise<void>) => {
      if (pending) return false;
      pending = true;
      try {
        await startPlayback();
        return true;
      } finally {
        pending = false;
      }
    },
  };
};
