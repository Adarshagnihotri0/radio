import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { authApi } from '@/services/auth.api';
import toast from 'react-hot-toast';

export function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const setTokens = useAuthStore((s) => s.setTokens);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const tokens = await authApi.login({ email, password });
            setTokens(tokens);
            void navigate('/channels');
        } catch {
            toast.error('Invalid credentials');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="text-radar-500 text-5xl mb-3">◉</div>
                    <h1 className="text-2xl font-bold text-radar-400 tracking-widest uppercase">Radius</h1>
                    <p className="text-gray-500 text-sm mt-1">Tactical Push-to-Talk</p>
                </div>

                <form onSubmit={(e) => void handleSubmit(e)} className="hud-card space-y-4">
                    <div>
                        <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1">
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-radar-600"
                            placeholder="operator@example.com"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1">
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-radar-600"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 bg-radar-700 hover:bg-radar-600 disabled:opacity-50 text-white rounded text-sm font-medium tracking-widest uppercase transition-colors"
                    >
                        {loading ? 'Connecting...' : 'Login'}
                    </button>
                </form>

                <p className="text-center text-sm text-gray-600 mt-4">
                    No account?{' '}
                    <Link to="/register" className="text-radar-500 hover:text-radar-400">
                        Register
                    </Link>
                </p>
            </div>
        </div>
    );
}
