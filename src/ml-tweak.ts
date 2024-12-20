import type { MathfieldElement, Keybinding } from 'mathlive'

export function configureMF(mfe: MathfieldElement) {
  mfe.smartFence = logseq.settings?.smartFence ?? true
  mfe.smartMode = logseq.settings?.smartMode ?? false
  mfe.smartSuperscript = logseq.settings?.smartSuperscript ?? false
  // Filter out compute engine related stuffs
  mfe.menuItems = mfe.menuItems.filter((item) => !item.id?.startsWith('ce-'))
  try {
    mfe.keybindings = [
      ...mfe.keybindings.filter(
        (keybinding) =>
          !logseq.settings?.keybindings.some(
            (k: Keybinding) =>
              k.key === keybinding.key &&
              k.ifMode === keybinding.ifMode &&
              k.ifLayout === keybinding.ifLayout &&
              k.ifPlatform === keybinding.ifPlatform,
          ),
      ),
      // Allow disable builtin by set command to null
      ...logseq.settings?.keybindings.filter((k: Keybinding) => !!k.command),
    ]
  } catch (err) {
    logseq.UI.showMsg(`Fail to configure MathLive keybindings: ${err}`, 'error')
  }
  try {
    mfe.inlineShortcuts = {
      ...(logseq.settings?.disableDefaultShortcuts ? null : mfe.inlineShortcuts),
      ...logseq.settings?.inlineShortcuts,
    }
  } catch (err) {
    logseq.UI.showMsg(`Fail to configure MathLive inline shortcuts: ${err}`, 'error')
  }
  try {
    mfe.macros = { ...mfe.macros, ...logseq.settings?.macros }
  } catch (err) {
    logseq.UI.showMsg(`Fail to configure MathLive macros: ${err}`, 'error')
  }
}
