import { describe, expect, it } from 'vitest'
import { XHS_CAPTURE_NOTE_STATE_EXPRESSION } from './xhs-extractors'

class FakeElement {
  innerText: string
  textContent: string
  className: string
  nextElementSibling?: FakeElement
  previousElementSibling?: FakeElement
  parentElement?: FakeElement
  children: FakeElement[]

  constructor(text = '', children: FakeElement[] = [], className = '') {
    this.innerText = text
    this.textContent = text
    this.className = className
    this.children = children
    for (const [index, child] of children.entries()) {
      child.parentElement = this
      child.previousElementSibling = children[index - 1]
      child.nextElementSibling = children[index + 1]
    }
  }

  getAttribute(_name: string) {
    return ''
  }

  querySelector(_selector: string) {
    return null
  }
}

function evaluateCaptureExpression(options: {
  url: string
  actionNodes: FakeElement[]
  selectorMap?: Record<string, FakeElement | null>
}) {
  const selectorMap = options.selectorMap || {}
  const document = {
    body: {
      innerText: options.actionNodes.map(node => node.innerText).join('\n'),
    },
    querySelector: (selector: string) => selectorMap[selector] || null,
    querySelectorAll: (selector: string) => {
      if (selector === 'button, [role="button"], span, div') return options.actionNodes
      return []
    },
  }
  const url = new URL(options.url)
  const window = {
    location: {
      href: url.href,
      pathname: url.pathname,
    },
  }

  return JSON.parse(new Function('window', 'document', 'URL', `return ${XHS_CAPTURE_NOTE_STATE_EXPRESSION.trim()}`)(window, document, URL))
}

describe('XHS_CAPTURE_NOTE_STATE_EXPRESSION', () => {
  it('does not read relative time as action metrics when XHS action buttons have no counts', () => {
    const like = new FakeElement('点赞')
    const collect = new FakeElement('收藏')
    const comment = new FakeElement('评论')
    const share = new FakeElement('分享')
    const time = new FakeElement('12分钟前 广东')
    const actionBar = new FakeElement('', [like, collect, comment, share, time])

    const state = evaluateCaptureExpression({
      url: 'https://www.xiaohongshu.com/explore/6a1d4b3e00000000060308df?xsec_token=token',
      actionNodes: [actionBar, like, collect, comment, share, time],
    })

    expect(state.note.interactInfo).toEqual({
      likedCount: 0,
      collectedCount: 0,
      commentCount: 0,
      sharedCount: 0,
    })
  })
})
