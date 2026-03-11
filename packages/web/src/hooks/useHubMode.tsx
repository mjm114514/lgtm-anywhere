import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { fetchHubInfo } from "../api";

interface HubModeContextValue {
  isHub: boolean;
  loading: boolean;
}

const HubModeContext = createContext<HubModeContextValue>({
  isHub: false,
  loading: true,
});

export function HubModeProvider({ children }: { children: ReactNode }) {
  const [isHub, setIsHub] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHubInfo()
      .then((info) => {
        setIsHub(info.isHub);
        setLoading(false);
      })
      .catch(() => {
        // Not a hub (404 or error) — normal mode
        setIsHub(false);
        setLoading(false);
      });
  }, []);

  return (
    <HubModeContext.Provider value={{ isHub, loading }}>
      {children}
    </HubModeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useHubMode(): HubModeContextValue {
  return useContext(HubModeContext);
}
