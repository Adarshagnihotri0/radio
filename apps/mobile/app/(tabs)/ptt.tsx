import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Animated,
    Vibration,
} from 'react-native';
import { useRef, useCallback, useEffect } from 'react';
import { useChannelStore } from '../../src/stores/channel.store';
import { usePtt } from '../../src/hooks/usePtt';

export default function PttScreen() {
    const activeChannelId = useChannelStore((s) => s.activeChannelId);
    const channels = useChannelStore((s) => s.channels);
    const activeChannel = channels.find((c) => c._id === activeChannelId);

    const { isTransmitting, isChannelBusy, startTransmit, stopTransmit } = usePtt(activeChannelId);

    const pulseAnim = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (isTransmitting) {
            Vibration.vibrate(50);
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.08, duration: 400, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
                ]),
            ).start();
            Animated.timing(glowAnim, { toValue: 1, duration: 150, useNativeDriver: false }).start();
        } else {
            pulseAnim.stopAnimation();
            Animated.timing(pulseAnim, { toValue: 1, duration: 100, useNativeDriver: true }).start();
            Animated.timing(glowAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
        }
    }, [isTransmitting, pulseAnim, glowAnim]);

    const handlePressIn = useCallback(() => {
        void startTransmit();
    }, [startTransmit]);

    const handlePressOut = useCallback(() => {
        stopTransmit();
    }, [stopTransmit]);

    if (!activeChannelId || !activeChannel) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📡</Text>
                <Text style={styles.emptyText}>NO ACTIVE CHANNEL</Text>
                <Text style={styles.emptySubtext}>Select a channel from the Channels tab</Text>
            </View>
        );
    }

    const btnColor = isTransmitting
        ? '#22c55e'
        : isChannelBusy
            ? '#ef4444'
            : '#166534';

    return (
        <View style={styles.container}>
            {/* Channel HUD */}
            <View style={styles.hudCard}>
                <Text style={styles.hudLabel}>ACTIVE CHANNEL</Text>
                <Text style={styles.channelName}>{activeChannel.name}</Text>
                <Text style={styles.frequency}>{activeChannel.frequency} MHz</Text>
                <Text style={styles.userCount}>{activeChannel.activeUsers} online</Text>
            </View>

            {/* PTT Button */}
            <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
                <Animated.View
                    style={[
                        styles.pttOuter,
                        {
                            transform: [{ scale: pulseAnim }],
                            borderColor: btnColor,
                            shadowColor: btnColor,
                            shadowOpacity: isTransmitting ? 0.7 : 0.2,
                            shadowRadius: isTransmitting ? 30 : 10,
                            shadowOffset: { width: 0, height: 0 },
                            elevation: isTransmitting ? 15 : 4,
                        },
                    ]}
                >
                    <View style={[styles.pttInner, { backgroundColor: isTransmitting ? btnColor : 'transparent' }]}>
                        <Text style={[styles.pttIcon, { color: isTransmitting ? '#052e16' : btnColor }]}>
                            🎙
                        </Text>
                    </View>
                </Animated.View>
            </Pressable>

            {/* Status text */}
            <Text style={[styles.statusText, { color: isTransmitting ? '#22c55e' : '#4b5563' }]}>
                {isTransmitting
                    ? '◉  TRANSMITTING'
                    : isChannelBusy
                        ? '⬤  CHANNEL BUSY'
                        : 'HOLD TO TALK'}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#030712',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
        paddingHorizontal: 24,
    },
    emptyContainer: {
        flex: 1,
        backgroundColor: '#030712',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    emptyIcon: { fontSize: 40, marginBottom: 8 },
    emptyText: { color: '#6b7280', fontSize: 13, letterSpacing: 3, fontFamily: 'monospace' },
    emptySubtext: { color: '#374151', fontSize: 11, fontFamily: 'monospace' },

    hudCard: {
        backgroundColor: '#111827',
        borderWidth: 1,
        borderColor: '#166534',
        borderRadius: 12,
        padding: 20,
        alignItems: 'center',
        width: '100%',
    },
    hudLabel: { color: '#6b7280', fontSize: 10, letterSpacing: 4, fontFamily: 'monospace', marginBottom: 6 },
    channelName: { color: '#86efac', fontSize: 20, fontWeight: 'bold', fontFamily: 'monospace' },
    frequency: { color: '#4ade80', fontSize: 14, letterSpacing: 3, fontFamily: 'monospace', marginTop: 4 },
    userCount: { color: '#6b7280', fontSize: 12, fontFamily: 'monospace', marginTop: 4 },

    pttOuter: {
        width: 160,
        height: 160,
        borderRadius: 80,
        borderWidth: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pttInner: {
        width: 130,
        height: 130,
        borderRadius: 65,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pttIcon: { fontSize: 52 },
    statusText: {
        fontFamily: 'monospace',
        fontSize: 12,
        letterSpacing: 4,
        marginTop: 8,
    },
});
