import { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { eventsClient } from "../modules/events/client";

const client = new QueryClient();

export function AppProviders({ children }: PropsWithChildren) {
  useEffect(() => {
    eventsClient.connect();
  }, []);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}


