"use client";

import { useEffect } from "react";

/**
 * Sets `document.title` for "use client" pages (e.g. admin dashboard).
 * Follows the same template as the root layout metadata:
 *   "<pageTitle> | 1008 Hair Studio"
 */
export function usePageTitle(pageTitle: string) {
  useEffect(() => {
    document.title = `${pageTitle} | 1008 Hair Studio`;
  }, [pageTitle]);
}
