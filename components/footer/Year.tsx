import { cacheLife } from "next/cache";

// Cache Components needs `use cache` around Date; the year only changes on redeploy.
export async function Year() {
  "use cache";
  cacheLife("max");
  return <>{new Date().getFullYear()}</>;
}
