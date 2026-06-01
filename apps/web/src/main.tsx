import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            retry: 2,
        },
    },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <App />
            <Toaster
                position="top-right"
                toastOptions={{
                    style: {
                        background: '#1a1a2e',
                        color: '#e5e7eb',
                        border: '1px solid #22c55e33',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '13px',
                    },
                }}
            />
        </QueryClientProvider>
    </React.StrictMode>,
);
