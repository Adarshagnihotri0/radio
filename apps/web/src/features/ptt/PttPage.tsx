import { useChannelStore } from '@/stores/channel.store';
import { PttButton } from './PttButton';
import { usePtt } from './usePtt';
import { SignalBars } from '@/components/SignalBars';

export function PttPage() {
    const activeChannelId = useChannelStore((s) => s.activeChannelId);
    const channels = useChannelStore((s) => s.channels);
    const activeChannel = channels.find((c) => c._id === activeChannelId);

    const { isTransmitting, isChannelBusy, currentSpeakerId, startTransmit, stopTransmit } =
        usePtt(activeChannelId);

    if (!activeChannelId || !activeChannel) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-500">
                <p className="text-2xl">📡</p>
                <p className="text-sm tracking-widest uppercase">No active channel</p>
                <p className="text-xs text-gray-600">Select a channel from the channel list</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center h-full gap-8 p-6">
            {/* Channel info */}
            <div className="hud-card w-full max-w-sm text-center">
                <div className="scan-overlay rounded-lg" />
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Active Channel</p>
                <h2 className="text-xl text-radar-400 font-bold tracking-wide">{activeChannel.name}</h2>
                <p className="freq-display mt-1">{activeChannel.frequency} MHz</p>
                <div className="flex items-center justify-center gap-2 mt-3">
                    <SignalBars strength={3} />
                    <span className="text-xs text-gray-400">{activeChannel.activeUsers} online</span>
                </div>
            </div>

            {/* Speaker status */}
            {currentSpeakerId && !isTransmitting && (
                <div className="text-sm text-amber-400 animate-pulse flex items-center gap-2">
                    <span>◉</span>
                    <span>User transmitting...</span>
                </div>
            )}

            {/* PTT button */}
            <PttButton
                isTransmitting={isTransmitting}
                isChannelBusy={isChannelBusy}
                onStart={() => void startTransmit()}
                onStop={stopTransmit}
            />

            {/* Radio beep hint */}
            {isTransmitting && (
                <p className="text-xs text-radar-600 animate-pulse">🔊 Broadcasting on {activeChannel.frequency} MHz</p>
            )}
        </div>
    );
}
