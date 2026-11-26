import { create } from "zustand";

export type CelebrationKind = "quiz" | "flashcards" | "streak";

export type CelebrationPayload = {
  kind: CelebrationKind;
  title: string;
  message: string;
};

type CelebrationState = CelebrationPayload & {
  isVisible: boolean;
  id: number;
  trigger: (payload: CelebrationPayload) => void;
  dismiss: () => void;
};

const EMPTY_STATE: CelebrationPayload = {
  kind: "quiz",
  title: "",
  message: "",
};

export const useCelebrationStore = create<CelebrationState>((set) => ({
  ...EMPTY_STATE,
  isVisible: false,
  id: 0,
  trigger: (payload) =>
    set((state) => ({
      ...payload,
      isVisible: true,
      id: state.id + 1,
    })),
  dismiss: () =>
    set((state) => ({
      ...state,
      isVisible: false,
    })),
}));
