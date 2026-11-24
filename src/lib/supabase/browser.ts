"use client";
import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "../env";

/** Browser client, used only to upload images straight to Supabase Storage. */
export function createSupabaseBrowser() {
  return createBrowserClient(SUPABASE_URL!, SUPABASE_PUBLIC_KEY!);
}
