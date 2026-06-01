import { Tabs } from 'expo-router';
import { Radio, Map, List } from 'lucide-react-native';

export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                tabBarStyle: {
                    backgroundColor: '#111827',
                    borderTopColor: '#1a2e1a',
                },
                tabBarActiveTintColor: '#22c55e',
                tabBarInactiveTintColor: '#6b7280',
                headerStyle: { backgroundColor: '#111827' },
                headerTintColor: '#22c55e',
                headerTitleStyle: { fontFamily: 'monospace', letterSpacing: 3, fontSize: 13 },
            }}
        >
            <Tabs.Screen
                name="channels"
                options={{
                    title: 'CHANNELS',
                    tabBarIcon: ({ color, size }) => <List color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="ptt"
                options={{
                    title: 'PTT',
                    tabBarIcon: ({ color, size }) => <Radio color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="map"
                options={{
                    title: 'MAP',
                    tabBarIcon: ({ color, size }) => <Map color={color} size={size} />,
                }}
            />
        </Tabs>
    );
}
