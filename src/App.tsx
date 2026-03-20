import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AppProviders } from "./AppProviders";
import { AppRoutes } from "./AppRoutes";

const queryClient = new QueryClient();

const App = () => (
  <AppProviders queryClient={queryClient}>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AppRoutes />
    </BrowserRouter>
  </AppProviders>
);

export default App;
