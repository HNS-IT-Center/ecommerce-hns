import { unstable_cache } from "next/cache";
import { getPrisma } from "@/lib/prisma/client";

export type Brand = {
  id: number;
  name: string;
  slug: string;
};

export async function getBrands(): Promise<Brand[]> {
  const fetcher = unstable_cache(
    async () => {
      const brands = await getPrisma().brand.findMany({
        orderBy: { name: 'asc' },
      });
      return brands;
    },
    ["shop-brands"],
    { revalidate: 3600, tags: ["shop-brands"] }
  );

  return fetcher();
}
