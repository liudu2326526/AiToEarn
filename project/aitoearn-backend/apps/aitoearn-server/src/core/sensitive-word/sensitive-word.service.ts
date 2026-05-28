import { Injectable } from '@nestjs/common'

interface DfaNode {
  children: Map<string, DfaNode>
  word?: string
}

export interface SensitiveWordCheckResult {
  passed: boolean
  hits: string[]
}

const DEFAULT_WORDS = [
  'v信',
  'vx',
  'wx',
  '微信',
  '薇信',
  '威信',
  '加我',
  '➕我',
  '企微',
]

const PHONE_PATTERN = /(?<!\d)1[3-9]\d{9}(?!\d)/g
const URL_PATTERN = /https?:\/\/[^\s]+|www\.[^\s]+/gi

@Injectable()
export class SensitiveWordService {
  private readonly defaultRoot: DfaNode

  constructor() {
    this.defaultRoot = this.buildTree(DEFAULT_WORDS)
  }

  check(text: string, customWords: string[] = []): SensitiveWordCheckResult {
    const root = customWords.length > 0
      ? this.buildTree([...DEFAULT_WORDS, ...customWords])
      : this.defaultRoot

    const hits = [
      ...this.matchWords(text, root),
      ...this.matchPattern(text, PHONE_PATTERN),
      ...this.matchPattern(text, URL_PATTERN),
    ]
    const uniqueHits = Array.from(new Set(hits))
    return {
      passed: uniqueHits.length === 0,
      hits: uniqueHits,
    }
  }

  private matchWords(text: string, root: DfaNode): string[] {
    const hits: string[] = []

    for (let start = 0; start < text.length; start += 1) {
      let node = root
      for (let index = start; index < text.length; index += 1) {
        const char = text[index].toLowerCase()
        const next = node.children.get(char)
        if (!next)
          break
        node = next
        if (node.word) {
          hits.push(node.word)
          break
        }
      }
    }

    return hits
  }

  private buildTree(words: string[]): DfaNode {
    const root: DfaNode = { children: new Map() }

    for (const word of words.filter(Boolean)) {
      let node = root
      for (const char of word.toLowerCase()) {
        let next = node.children.get(char)
        if (!next) {
          next = { children: new Map() }
          node.children.set(char, next)
        }
        node = next
      }
      node.word = word
    }

    return root
  }

  private matchPattern(text: string, pattern: RegExp): string[] {
    pattern.lastIndex = 0
    return Array.from(text.matchAll(pattern), match => match[0])
  }
}
