import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { ChannelsPage } from '@/features/channels/ChannelsPage';
import { MapPage } from '@/features/maps/MapPage';
import { PttPage } from '@/features/ptt/PttPage';
import { WatchPartyPage } from '@/features/watch/WatchPartyPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route
                    path="/"
                    element={
                        <PrivateRoute>
                            <DashboardLayout />
                        </PrivateRoute>
                    }
                >
                    <Route index element={<Navigate to="/channels" replace />} />
                    <Route path="channels" element={<ChannelsPage />} />
                    <Route path="map" element={<MapPage />} />
                    <Route path="ptt" element={<PttPage />} />
                    <Route path="watch" element={<WatchPartyPage />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}
