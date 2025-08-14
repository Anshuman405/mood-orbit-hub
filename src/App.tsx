import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Navigation } from "./components/layout/Navigation";
import { useRealtimeUpdates } from "./hooks/useRealtimeUpdates";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Feed from "./pages/Feed";
import PostSong from "./pages/PostSong";
import PostDetail from "./pages/PostDetail";
import Profile from "./pages/Profile";
import Discover from "./pages/Discover";
import Upload from "./pages/Upload";

const queryClient = new QueryClient();

function AppContent() {
  useRealtimeUpdates();
  return (
    <>
      <Navigation />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/feed" element={<Feed />} />
        <Route path="/post" element={<PostSong />} />
        <Route path="/post/:id" element={<PostDetail />} />
        <Route path="/profile/:id" element={<Profile />} />
        <Route path="/discover" element={<Discover />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/challenges" element={<div className="p-8 text-center">Challenges coming soon!</div>} />
        <Route path="/ai" element={<div className="p-8 text-center">AI Hub coming soon!</div>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
