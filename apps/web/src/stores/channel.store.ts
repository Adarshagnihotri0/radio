import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Channel {
  _id: string;
  name: string;
  frequency: string;
  center: { type: 'Point'; coordinates: [number, number] };
  radiusKm: number;
  activeUsers: number;
  encrypted: boolean;
}

interface ChannelStore {
  channels: Channel[];
  activeChannelId: string | null;
  speaking: boolean;
  currentSpeakerId: string | null;

  setChannels: (channels: Channel[]) => void;
  setActiveChannel: (channelId: string | null) => void;
  setSpeaking: (speaking: boolean) => void;
  setCurrentSpeaker: (userId: string | null) => void;
}

export const useChannelStore = create<ChannelStore>()(
  persist(
    (set) => ({
      channels: [],
      activeChannelId: null,
      speaking: false,
      currentSpeakerId: null,

      setChannels: (channels) => set({ channels }),
      setActiveChannel: (channelId) => set({ activeChannelId: channelId }),
      setSpeaking: (speaking) => set({ speaking }),
      setCurrentSpeaker: (userId) => set({ currentSpeakerId: userId }),
    }),
    {
      name: 'radius-channel-store',
      partialize: (state) => ({ activeChannelId: state.activeChannelId }),
    },
  ),
);
