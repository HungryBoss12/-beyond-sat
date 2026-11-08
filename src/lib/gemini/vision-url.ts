const STORAGE_OBJECT_PATH = /^\/storage\/v1\/object\/(?:sign|public|authenticated)\//i;

/** Only this project's storage objects are fetched for Gemini, never another `*.supabase.co` host. */
export function isAllowedVisionUrl(url: URL, storageHost: string | undefined): boolean {
  return (
    !!storageHost &&
    url.protocol === "https:" &&
    url.hostname === storageHost &&
    STORAGE_OBJECT_PATH.test(url.pathname)
  );
}
