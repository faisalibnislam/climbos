/** Platform names in a plan label are draft destinations, never publishing permission. */
export const SOCIAL_CHANNELS = ["instagram", "facebook", "linkedin", "x", "tiktok", "pinterest", "youtube"] as const;
export type SocialChannel = (typeof SOCIAL_CHANNELS)[number];
const SOCIAL_NAME: Record<SocialChannel, RegExp> = {
  instagram: /\binstagram\b|\binsta\b/i,
  facebook: /\bfacebook\b|\bfb\b|\bmeta (?:page|organic)\b/i,
  linkedin: /\blinked\s?in\b/i,
  x: /\btwitter\b|\bx\.com\b|\bon x\b|^x$/i,
  tiktok: /\btik\s?tok\b/i,
  pinterest: /\bpinterest\b/i,
  youtube: /\byoutube\b/i,
};
export function namedSocialChannels(channel: { key: string; name: string }): SocialChannel[] {
  if (/\b(?:not|avoid|without|instead|versus|vs|or|groups?|forums?|communities|community)\b/i.test(channel.name)) return [];
  return SOCIAL_CHANNELS.filter(platform => channel.key === platform || SOCIAL_NAME[platform].test(channel.name));
}
export function isSocialChannel(value: string): value is SocialChannel {
  return (SOCIAL_CHANNELS as readonly string[]).includes(value);
}
