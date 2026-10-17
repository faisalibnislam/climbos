import type { Doc, Id } from "../_generated/dataModel";
import { r2SignedUrl } from "./r2";

type StorageReader = { storage: { getUrl: (id: Id<"_storage">) => Promise<string | null> } };

/** Public URL for a version's image: short-lived signed R2 URL, or Convex storage URL. */
export async function imageUrlFor(ctx: StorageReader, ver: Pick<Doc<"artifactVersions">, "imageStorageId" | "imageR2Key">): Promise<string | null> {
  if (ver.imageR2Key) return r2SignedUrl(ver.imageR2Key, 3600);
  if (ver.imageStorageId) return ctx.storage.getUrl(ver.imageStorageId);
  return null;
}

export function imageRefOf(ver: Pick<Doc<"artifactVersions">, "imageStorageId" | "imageR2Key"> | null | undefined): string | undefined {
  return ver?.imageR2Key ?? ver?.imageStorageId ?? undefined;
}
