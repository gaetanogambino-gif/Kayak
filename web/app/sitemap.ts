import type { MetadataRoute } from "next";
import { getAllSpots, MONTHS } from "@/lib/data";
import { site } from "@/config/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const spots = await getAllSpots();
  const now = new Date();
  const urls: MetadataRoute.Sitemap = [
    { url: site.url, lastModified: now, changeFrequency: "weekly", priority: 1 },
  ];
  for (const m of MONTHS) {
    urls.push({ url: `${site.url}/mese/${m}`, lastModified: now, changeFrequency: "monthly" });
  }
  for (const s of spots) {
    urls.push({ url: `${site.url}/spot/${s.slug}`, lastModified: now, changeFrequency: "monthly" });
    for (const m of MONTHS) {
      urls.push({ url: `${site.url}/kite/${s.slug}/${m}`, changeFrequency: "monthly" });
    }
  }
  return urls;
}
