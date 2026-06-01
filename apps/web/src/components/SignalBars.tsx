interface SignalBarsProps {
    strength: 0 | 1 | 2 | 3 | 4; // 0 = none, 4 = full
}

const HEIGHTS = ['h-2', 'h-3', 'h-4', 'h-5', 'h-6'];
const COLORS = {
    active: 'bg-radar-500',
    inactive: 'bg-gray-700',
};

export function SignalBars({ strength }: SignalBarsProps) {
    return (
        <div className="flex items-end gap-0.5 h-6">
            {HEIGHTS.map((h, i) => (
                <div
                    key={i}
                    className={`signal-bar ${h} w-1.5 ${i < strength ? COLORS.active : COLORS.inactive}`}
                />
            ))}
        </div>
    );
}
