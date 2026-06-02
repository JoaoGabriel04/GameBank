"use client";

import { useEffect, useState } from "react";
import { getBannersApi, type PublicBanner } from "@/services/api/banners";

export function useBannerCatalog() {
  const [banners, setBanners] = useState<PublicBanner[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getBannersApi()
      .then((data) => {
        if (!cancelled) setBanners(data);
      })
      .catch(() => {
        if (!cancelled) setBanners([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return banners;
}
