import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { AdminPage } from './features/admin/AdminPage';
import { GalleryPage } from './features/gallery/GalleryPage';
import { LinkTreePage } from './features/linktree/LinkTreePage';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });

export function App() {
  const adminEnabled = import.meta.env.DEV;
  return <QueryClientProvider client={queryClient}><HashRouter><Routes><Route path="/" element={<LinkTreePage />} /><Route path="/links/:slug" element={<LinkTreePage />} /><Route path="/casas/:slug" element={<GalleryPage />} />{adminEnabled && <Route path="/admin" element={<AdminPage />} />}<Route path="*" element={<LinkTreePage />} /></Routes></HashRouter></QueryClientProvider>;
}
