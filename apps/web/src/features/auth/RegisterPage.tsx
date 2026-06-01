import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { authApi } from '@/services/auth.api';
import toast from 'react-hot-toast';

export function RegisterPage() {
    const [form, setForm] = useState({ username: '', email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const setTokens = useAuthStore((s) => s.setTokens);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const tokens = await authApi.register(form);
            setTokens(tokens);
            void navigate('/channels');
        } catch {
            toast.error('Registration failed — username or email may be taken');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <div className="text-radar-500 text-5xl mb-3">◉</div>
                    <h1 className="text-2xl font-bold text-radar-400 tracking-widest uppercase">Radius</h1>
                    <p className="text-gray-500 text-sm mt-1">Create operator account</p>
                </div>

                <form onSubmit={(e) => void handleSubmit(e)} className="hud-card space-y-4">
                    {(['username', 'email', 'password'] as const).map((field) => (
                        <div key={field}>
                            <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1">
                                {field}
                            </label>
                            <input
                                type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
                                value={form[field]}
                                onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                                required
                                minLength={field === 'username' ? 3 : field === 'password' ? 8 : undefined}
                                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-radar-600"
                            />
                        </div>
                    ))}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 bg-radar-700 hover:bg-radar-600 disabled:opacity-50 text-white rounded text-sm font-medium tracking-widest uppercase transition-colors"
                    >
                        {loading ? 'Creating account...' : 'Register'}
                    </button>
                </form>

                <p className="text-center text-sm text-gray-600 mt-4">
                    Already have an account?{' '}
                    <Link to="/login" className="text-radar-500 hover:text-radar-400">
                        Login
                    </Link>
                </p>
            </div>
        </div>
    );
}
