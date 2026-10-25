/** Keyboard-accessible shortcut to the primary content region. */
export function SkipLink({ targetId = "main", children = "Skip to main content" }: {
  targetId?: string;
  children?: string;
}) {
  return <a className="skip-link" href={`#${targetId}`}>{children}</a>;
}
