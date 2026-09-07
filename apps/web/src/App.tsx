import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { GalleryPage } from './features/gallery/GalleryPage';
import { LinkTreePage } from './features/linktree/LinkTreePage';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });

export function App() {
  return <QueryClientProvider client={queryClient}><HashRouter><Routes><Route path="/" element={<LinkTreePage />} /><Route path="/casas/:slug" element={<GalleryPage />} /><Route path="*" element={<LinkTreePage />} /></Routes></HashRouter></QueryClientProvider>;
}
