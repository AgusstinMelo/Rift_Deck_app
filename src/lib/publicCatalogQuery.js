export const PUBLIC_CATALOG_REFRESH_INTERVAL = 60 * 1000;

export const publicCatalogQueryOptions = {
  staleTime: 0,
  refetchOnMount: 'always',
  refetchOnWindowFocus: 'always',
  refetchInterval: PUBLIC_CATALOG_REFRESH_INTERVAL,
};
