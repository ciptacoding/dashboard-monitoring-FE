import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthGuard } from "@/components/AuthGuard";
import { useAuth } from "@/state/useAuth";
import Login from "./routes/Login";
import Dashboard from "./routes/Dashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
	queries: {
	  staleTime: 60 * 1000, // 1 minute
	  refetchOnWindowFocus: false,
	}
  }
});

const AppContent = () => {
  const { checkAuth } = useAuth();
  useEffect(() => {
	checkAuth(); //cehck authentication on app mount
  }, [checkAuth]);

  return (
	<>
	  <Toaster />
	  <Sonner position="top-right" richColors/>
	  <Routes>
      {/* public routes */}
      <Route path="/login" element={<Login />} />

      {/* Protected Routes */}
      <Route 
        path="/dashboard" 
        element={
          <AuthGuard>
            <Dashboard />
          </AuthGuard>
        }
      />

      {/* Redirect root to dashboard */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* 404 Not Found */}
      <Route path="*" element={<NotFound />} />
	  </Routes>
	</>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
