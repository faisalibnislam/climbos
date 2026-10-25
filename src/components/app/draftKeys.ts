/** Browser-tab draft keys are isolated by both signed-in person and workspace. */
export function askDraftKey(slug: string, userId: string) {
  return `climbos:ask:v2:${userId}:${slug}`;
}

export function wishDraftKey(slug: string, userId: string) {
  return `climbos:wish:v1:${userId}:${slug}`;
}
