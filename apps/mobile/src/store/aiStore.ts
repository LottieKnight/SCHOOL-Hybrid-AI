import { create } from "zustand";

export type AIMessage = {
  role: "user" | "assistant";
  content: string;
};

type AIState = {
  isOpen: boolean;
  isLoading: boolean;
  messages: AIMessage[];
  context: string | null;
  open: (context?: string) => void;
  close: () => void;
  setLoading: (loading: boolean) => void;
  addMessage: (message: AIMessage) => void;
  clearMessages: () => void;
  setContext: (context: string | null) => void;
};

export const useAIStore = create<AIState>((set) => ({
  isOpen: false,
  isLoading: false,
  messages: [],
  context: null,

  open: (context) => set({ isOpen: true, context: context ?? null }),
  close: () => set({ isOpen: false }),
  setLoading: (isLoading) => set({ isLoading }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  clearMessages: () => set({ messages: [] }),
  setContext: (context) => set({ context }),
}));
