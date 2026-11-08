import { useQuery } from "@tanstack/react-query";
import { events as sampleEvents, type REvent } from "@/data/catalog";
import { fetchCatalogueEvents } from "@/lib/api.functions";

export type EventWithMeta = REvent & {
  artists: string[];
  terms: string;
  organiserId: string | null;
  published: boolean;
};

export function useCatalogEvents() {
  const query = useQuery({
    queryKey: ["rangora-events"],
    queryFn: async () => {
      const data = await fetchCatalogueEvents();
      return data as EventWithMeta[];
    },
  });

  return {
    ...query,
    events: query.data?.length
      ? query.data
      : sampleEvents.map((event) => ({
          ...event,
          artists: [],
          terms: "",
          organiserId: null,
          published: true,
        })),
  };
}
