/** Is a dialog open (filter, settings, search)? Then view-level keyboard shortcuts stay quiet. */
export const dialogOpen = () => Boolean(document.querySelector('.sheet-root, .palette-root'));

/** Is the user typing into a form field? */
export const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
