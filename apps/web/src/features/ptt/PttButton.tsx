import { useRef, useEffect } from 'react';
import clsx from 'clsx';

interface PttButtonProps {
    isTransmitting: boolean;
    isChannelBusy: boolean;
    disabled?: boolean;
    onStart: () => void;
    onStop: () => void;
}

export function PttButton({ isTransmitting, isChannelBusy, disabled, onStart, onStop }: PttButtonProps) {
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Keyboard support: Space bar = PTT
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' && e.target === document.body && !e.repeat) {
                e.preventDefault();
                onStart();
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space' && e.target === document.body) {
                e.preventDefault();
                onStop();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [onStart, onStop]);

    return (
        <div className="flex flex-col items-center gap-4">
            <button
                ref={buttonRef}
                disabled={disabled}
                onPointerDown={onStart}
                onPointerUp={onStop}
                onPointerLeave={onStop}
                className={clsx(
                    'ptt-btn w-36 h-36 text-4xl',
                    isTransmitting && 'active',
                    isChannelBusy && !isTransmitting && 'border-red-500 text-red-400',
                    disabled && 'opacity-40 cursor-not-allowed',
                )}
                aria-label={isTransmitting ? 'Transmitting — release to stop' : 'Hold to talk'}
            >
                {/* Outer pulse ring when transmitting */}
                {isTransmitting && (
                    <span className="absolute inset-0 rounded-full animate-ping-slow bg-radar-500 opacity-30" />
                )}
                🎙
            </button>

            <div className="text-center">
                <p className={clsx(
                    'text-xs tracking-widest uppercase',
                    isTransmitting ? 'text-radar-400 animate-pulse-fast' : 'text-gray-500',
                )}>
                    {isTransmitting ? '◉ TRANSMITTING' : isChannelBusy ? '⬤ CHANNEL BUSY' : 'HOLD TO TALK'}
                </p>
                <p className="text-gray-600 text-xs mt-1">or hold [SPACE]</p>
            </div>
        </div>
    );
}
