import type { MathfieldElement } from 'mathlive'

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function openPopup(uuid: string) {
  const caret = await logseq.Editor.getEditingCursorPosition()
  if (caret === null) {
    logseq.UI.showMsg('Error getting cursor pos')
    return
  }
  const clientWidth = parent.document.documentElement.clientWidth
  const clientHeight = parent.document.documentElement.clientHeight
  const popup = {
    width: 200,
    marginLeft: 10,
    marginRight: 10,
    left: 0,
    top: 0,
    bottom: 0,
  }
  const popupMinHeight = 100
  const popupTopMargin = 20
  popup.left = caret.rect.left + caret.left - popup.width / 2 - popup.marginLeft
  popup.top = caret.rect.top + caret.top + popupTopMargin
  if (popup.width + popup.width * 2 > clientWidth) {
    popup.left = popup.marginLeft
    popup.width = clientWidth - popup.marginLeft - popup.marginRight
  } else {
    if (popup.left < 0) {
      popup.left = popup.marginLeft
    }
    if (popup.left + popup.width + popup.marginRight > clientWidth) {
      popup.left = clientWidth - popup.marginRight - popup.width
    }
    if (popup.top + popupMinHeight > clientHeight) {
      popup.bottom = clientHeight - popup.top + 2 * popupTopMargin
      popup.top = 0
    }
  }
  logseq.provideUI({
    key: 'popup',
    template: '<button>DONE</button>',
    style: {
      left: popup.left + 'px',
      top: popup.top ? popup.top + 'px' : 'initial',
      bottom: popup.bottom ? popup.bottom + 'px' : 'initial',
      width: popup.width + 'px',
      marginLeft: popup.marginLeft + 'px',
      marginRight: popup.marginRight + 'px',
    },
    attrs: {
      title: 'Live Math',
    },
  })
  await sleep(0)
  const floatContent = parent.document.querySelector(
    '#logseq-live-math--popup > .ls-ui-float-content',
  )

  if (floatContent === null) return

  // avoid Logseq catching keydown
  floatContent.addEventListener('keydown', (event) => event.stopPropagation())

  const mfe = parent.document.createElement('math-field') as MathfieldElement
  mfe.style.display = 'block'
  floatContent.prepend(mfe)
  await sleep(0)
  mfe.focus()
  try {
    mfe.keybindings = [...mfe.keybindings, ...logseq.settings?.keybindings]
  } catch (err) {
    logseq.UI.showMsg(`Fail to configure MathLive keybindings: ${err}`)
  }
  try {
    mfe.inlineShortcuts = {
      ...mfe.inlineShortcuts,
      ...logseq.settings?.inlineShortcuts,
    }
  } catch (err) {
    logseq.UI.showMsg(`Fail to configure MathLive inline shortcuts: ${err}`)
  }

  let done = false
  const insertLaTeX = async () => {
    if (done) return // avoid insert twice
    done = true
    logseq.provideUI({ key: 'popup', template: '' }) // close popup
    const block = await logseq.Editor.getCurrentBlock()
    if (block === null || block.uuid !== uuid) {
      logseq.UI.showMsg('Block changed!')
      return
    }
    let dollarEnd = caret.pos
    let dollarBegin = caret.pos
    while (block.content.charAt(dollarEnd) === '$') dollarEnd++
    while (block.content.charAt(dollarBegin - 1) === '$') dollarBegin--
    const delim = logseq.settings?.preferDisplay ? '$$' : '$'
    const contentBefore =
      block.content.substring(0, dollarBegin) + `${delim}${mfe.value}${delim}`
    const contentAfter = block.content.substring(
      dollarEnd,
      block.content.length,
    )
    await logseq.Editor.updateBlock(uuid, contentBefore + contentAfter)
    // HACK: `Editor.editBlock` does nothing, focusing using DOM ops
    const textarea = parent.document.querySelector<HTMLTextAreaElement>(
      `textarea[id$="${uuid}"]`,
    )
    if (textarea !== null) {
      textarea.focus()
      textarea.selectionEnd = contentBefore.length
    }
  }
  mfe.addEventListener('change', insertLaTeX)
  const btn = floatContent.querySelector<HTMLButtonElement>('button')
  btn?.addEventListener('click', insertLaTeX)
}