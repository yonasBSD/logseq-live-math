import type { UIBaseOptions } from '@logseq/libs/dist/LSPlugin.user'
import type { MathfieldElement } from 'mathlive'
import { configureMF } from './ml-tweak'

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function openPopup(uuid: string) {
  logseq.provideUI({
    key: 'popup',
    template: '<span></span>',
    style: await calcAlign(),
    attrs: {
      title: 'Live Math',
    },
  })
  await sleep(0)
  const popupContent = parent.document.getElementById('logseq-live-math--popup')
  if (popupContent === null) return
  const floatContent = popupContent.querySelector('.ls-ui-float-content')
  if (floatContent === null) return
  // keep block in editing mode after mousedown
  popupContent.addEventListener('mousedown', (event) => event.stopPropagation())
  // avoid Logseq catching keydown
  floatContent.addEventListener('keydown', (event) => event.stopPropagation())

  const mfe = parent.document.createElement('math-field') as MathfieldElement
  mfe.style.display = 'block'
  floatContent.prepend(mfe)
  await sleep(0)
  mfe.focus()
  configureMF(mfe)

  const textarea = parent.document.querySelector<HTMLTextAreaElement>(
    `textarea[id$="${uuid}"]`,
  )
  if (textarea == null) {
    logseq.UI.showMsg('Block changed!')
    return
  }
  const blockContent = textarea.value
  let dollarEnd = textarea.selectionEnd
  let dollarStart = textarea.selectionStart
  const originalContent = textarea.value.substring(dollarStart, dollarEnd)
  mfe.value = originalContent
  await sleep(0)
  applyAlign() // Resize box based on originalContent

  while (blockContent.charAt(dollarEnd) === '$') dollarEnd++
  while (blockContent.charAt(dollarStart - 1) === '$') dollarStart--
  const contentBefore = blockContent.substring(0, dollarStart)
  const contentAfter = blockContent.substring(dollarEnd, blockContent.length)
  const delim = logseq.settings?.preferDisplay ? '$$' : '$'

  let done = false
  parent.addEventListener('resize', applyAlign)
  popupContent.querySelector('.draggable-handle')?.addEventListener('mouseup', applyAlign)
  mfe.addEventListener('input', async () => {
    await applyAlign()
    if (mfe.value.includes('placeholder')) return // not a complete formula
    const contentBeforeCaret = contentBefore + `${delim}${mfe.value}${delim}`
    await logseq.Editor.updateBlock(uuid, contentBeforeCaret + contentAfter)
  })
  mfe.addEventListener('unmount', async () => {
    parent.removeEventListener('resize', applyAlign)
    if (done) return // don't clean up if inserted
    await logseq.Editor.updateBlock(
      uuid,
      contentBefore + originalContent + contentAfter,
    )
  })
  mfe.addEventListener('change', async () => {
    // Ignore focus lost
    if (!mfe.hasFocus()) return
    if (done) return // avoid insert twice
    done = true
    logseq.provideUI({ key: 'popup', template: '' }) // close popup
    const contentBeforeCaret = contentBefore + `${delim}${mfe.value}${delim}`
    await logseq.Editor.updateBlock(uuid, contentBeforeCaret + contentAfter)
    // HACK: `Editor.editBlock` does nothing, focusing using DOM ops
    textarea.focus()
    textarea.selectionEnd = contentBeforeCaret.length
  })
}

interface PopupAlign {
  width: number
  marginLeft: number
  marginRight: number
  left: number
  top: number
  bottom: number
}

function parseStyle(s: string): number {
  return parseInt(s.substring(0, s.length - 2), 10)
}

async function calcAlign(): Promise<UIBaseOptions['style']> {
  const popupMinHeight = 100
  const popupTopMargin = 20
  const popupDefaultWidth = 300
  const clientWidth = parent.document.documentElement.clientWidth
  const clientHeight = parent.document.documentElement.clientHeight
  const popupContent = parent.document.getElementById('logseq-live-math--popup')
  let popup: PopupAlign
  if (popupContent === null) {
    const caret = await logseq.Editor.getEditingCursorPosition()
    if (caret === null) {
      console.log('Error getting cursor pos')
      return
    }
    popup = {
      width: popupDefaultWidth,
      marginLeft: 10,
      marginRight: 10,
      left: 0,
      top: 0,
      bottom: 0,
    }
    popup.left =
      caret.rect.left + caret.left - popup.width / 4 - popup.marginLeft
    popup.top = caret.rect.top + caret.top + popupTopMargin
  } else {
    const scrollWidth = popupContent
      .querySelector('math-field')
      ?.shadowRoot?.querySelector('.ML__mathlive')?.scrollWidth
    popup = {
      width: scrollWidth
        ? Math.max(popupDefaultWidth, scrollWidth + 50)
        : popupContent.clientWidth,
      marginLeft: parseStyle(popupContent.style.marginLeft),
      marginRight: parseStyle(popupContent.style.marginLeft),
      left:
        parseStyle(popupContent.style.left) +
        parseInt(popupContent.dataset.dx ?? '0'),
      top:
        popupContent.style.top === 'initial'
          ? 0
          : parseStyle(popupContent.style.top) +
            parseInt(popupContent.dataset.dy ?? '0'),
      bottom:
        popupContent.style.bottom === 'initial'
          ? 0
          : parseStyle(popupContent.style.bottom) -
            parseInt(popupContent.dataset.dy ?? '0'),
    }
    console.log(popup)
  }
  if (popup.width + popup.marginLeft + popup.marginRight > clientWidth) {
    popup.left = 0
    popup.width = clientWidth - popup.marginLeft - popup.marginRight
  } else {
    if (popup.left < 0) {
      popup.left = popup.marginLeft
    }
    if (popup.left + popup.width + popup.marginRight > clientWidth) {
      popup.left = clientWidth - popup.marginRight - popup.width
    }
  }
  if (popup.top < 0) popup.top = popupTopMargin
  if (popup.bottom < 0) popup.bottom = popupTopMargin
  if (popup.top !== 0 && popup.top + popupMinHeight > clientHeight) {
    popup.bottom = clientHeight - popup.top + 2 * popupTopMargin
    popup.top = 0
  }
  return {
    left: popup.left + 'px',
    top: popup.top ? popup.top + 'px' : 'initial',
    bottom: popup.bottom ? popup.bottom + 'px' : 'initial',
    width: popup.width + 'px',
    marginLeft: popup.marginLeft + 'px',
    marginRight: popup.marginRight + 'px',
  }
}

async function applyAlign() {
  const styles = await calcAlign()
  if (styles === undefined) return
  const popupContent = parent.document.getElementById('logseq-live-math--popup')
  if (popupContent === null) return

  Object.entries(styles).forEach(([k, v]) => {
    popupContent.style.setProperty(k, v)
  })
  popupContent.dataset.dx = '0'
  popupContent.dataset.dy = '0'
  popupContent.style.transform = 'unset'
}
