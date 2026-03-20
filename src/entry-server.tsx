import { QueryClient } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { AppProviders } from "./AppProviders";
import { AppRoutes } from "./AppRoutes";

export function render(url = "/") {
  const queryClient = new QueryClient();

  return renderToString(
    <AppProviders queryClient={queryClient}>
      <StaticRouter location={url}>
        <AppRoutes />
      </StaticRouter>
    </AppProviders>,
  );
}
