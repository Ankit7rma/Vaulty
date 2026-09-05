import { describe, it, expect, vi } from 'vitest'
import { checkPasswordBreached } from './breach-check'

// SHA-1('password') = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
const PW_PREFIX = '5BAA6'
const PW_SUFFIX = '1E4C9B93F3F0682250B6CF8331B7EE68FD8'

describe('checkPasswordBreached', () => {
  it('sends only the SHA-1 prefix and detects a breach', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      // k-anonymity: only the 5-char prefix is ever transmitted.
      expect(url).toBe(`https://api.pwnedpasswords.com/range/${PW_PREFIX}`)
      const body = [`${PW_SUFFIX}:99999`, 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:5'].join(
        '\n',
      )
      return new Response(body, { status: 200 })
    })

    const result = await checkPasswordBreached(
      'password',
      fetchMock as unknown as typeof fetch,
    )
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(result).toEqual({ breached: true, count: 99999 })
  })

  it('reports not breached when the suffix is absent', async () => {
    const fetchMock = vi.fn(async () => new Response('ABC:1\nDEF:2', { status: 200 }))
    const result = await checkPasswordBreached(
      'password',
      fetchMock as unknown as typeof fetch,
    )
    expect(result).toEqual({ breached: false, count: 0 })
  })

  it('treats padded (count 0) entries as not breached', async () => {
    const fetchMock = vi.fn(
      async () => new Response(`${PW_SUFFIX}:0`, { status: 200 }),
    )
    const result = await checkPasswordBreached(
      'password',
      fetchMock as unknown as typeof fetch,
    )
    expect(result.breached).toBe(false)
  })

  it('does not call the API for an empty password', async () => {
    const fetchMock = vi.fn()
    const result = await checkPasswordBreached(
      '',
      fetchMock as unknown as typeof fetch,
    )
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result).toEqual({ breached: false, count: 0 })
  })
})
