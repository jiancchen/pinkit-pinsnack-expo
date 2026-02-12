import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import type { GenerationJob } from '../services/GenerationQueueService';

interface GenerationStatusStore {
  queue: GenerationJob[];
  setQueue: (queue: GenerationJob[]) => void;
  clearQueue: () => void;
}

export const useGenerationStatusStore = create<GenerationStatusStore>()(
  devtools(
    subscribeWithSelector((set) => ({
      queue: [],
      setQueue: (queue: GenerationJob[]) =>
        set(
          () => ({ queue }),
          false,
          `setGenerationQueue/${queue.length}`
        ),
      clearQueue: () => set(() => ({ queue: [] }), false, 'clearGenerationQueue'),
    })),
    { name: 'generation-status-store' }
  )
);

export const emitGenerationQueueUpdated = (queue: GenerationJob[]) => {
  useGenerationStatusStore.getState().setQueue(queue);
};

