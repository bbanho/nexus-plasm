// Clipboard port — environment-agnostic contract.
//
// Every clipboard adapter implements exactly this shape and nothing else.
// No adapter may know about window managers, keybindings, or display
// servers beyond the tool it shells out to. That keeps the core portable
// across Wayland/X11 and headless while the environment-specific wiring
// lives in plugins/ and can be swapped without touching the core.

/**
 * @typedef {Object} ClipboardPort
 * @property {() => Promise<boolean>} available  true if this backend can be used
 * @property {() => Promise<string>} read        current clipboard text ('' if empty)
 * @property {(text: string) => Promise<boolean>} write  true only if the write landed
 * @property {() => Promise<boolean>} hasImage    true if the clipboard holds an image
 * @property {string} name  stable identifier, used in logs and status output
 */

export class ClipboardUnavailable extends Error {
  constructor(message) {
    super(message);
    this.name = 'ClipboardUnavailable';
  }
}
