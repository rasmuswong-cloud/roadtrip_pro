declare namespace NodeJS {
  type ProcessEnv = {
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
    EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?: string;
    EXPO_PUBLIC_GOOGLE_PLACES_API_KEY?: string;
  };
}

declare const process: {
  env: NodeJS.ProcessEnv;
};
