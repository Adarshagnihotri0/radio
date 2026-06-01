import { create } from 'zustand';

interface Channel {
  _id: string;
  name: string;
  frequency: string;
  center: { type: 'Point'; coordinates: [number, number] };
  radiusKm: number;
  activeUsers: number;
  maxUsers: number;
  encrypted: boolean;
}

interface ChannelStore {
  channels: Channel[];
  activeChannelId: string | null;
  currentSpeakerId: string | null;
  setChannels: (channels: Channel[]) => void;
  setActiveChannel: (channelId: string | null) => void;
  setCurrentSpeaker: (userId: string | null) => void;
}

export const useChannelStore = create<ChannelStore>((set) => ({
  channels: [],
  activeChannelId: null,
  currentSpeakerId: null,
  setChannels: (channels) => set({ channels }),
  setActiveChannel: (channelId) => set({ activeChannelId: channelId }),
  setCurrentSpeaker: (userId) => set({ currentSpeakerId: userId }),
}));
