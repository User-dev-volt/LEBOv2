import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

import { invoke } from '@tauri-apps/api/core'
import { invokeCommand } from './invokeCommand'

const mockInvoke = vi.mocked(invoke)

describe('invokeCommand', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
  })

  it('returns the resolved value from invoke', async () => {
    mockInvoke.mockResolvedValue({ ok: true })
    const result = await invokeCommand('some_command')
    expect(result).toEqual({ ok: true })
  })

  it('passes command name and args to invoke', async () => {
    mockInvoke.mockResolvedValue(null)
    await invokeCommand('load_build', { id: '42' })
    expect(mockInvoke).toHaveBeenCalledWith('load_build', { id: '42' })
  })

  it('normalizes a plain string error from Tauri', async () => {
    mockInvoke.mockRejectedValue('NETWORK_ERROR: connection refused')
    await expect(invokeCommand('some_command')).rejects.toMatchObject({
      type: 'NETWORK_ERROR',
    })
  })

  it('normalizes an AUTH_ERROR string from Tauri', async () => {
    mockInvoke.mockRejectedValue('AUTH_ERROR: no key configured')
    await expect(invokeCommand('some_command')).rejects.toMatchObject({
      type: 'AUTH_ERROR',
      message: 'no key configured',
    })
  })

  it('normalizes an unknown error string as UNKNOWN', async () => {
    mockInvoke.mockRejectedValue('something completely unexpected')
    await expect(invokeCommand('some_command')).rejects.toMatchObject({
      type: 'UNKNOWN',
    })
  })

  it('normalizes a thrown Error instance as UNKNOWN', async () => {
    mockInvoke.mockRejectedValue(new Error('internal crash'))
    await expect(invokeCommand('some_command')).rejects.toMatchObject({
      type: 'UNKNOWN',
      detail: 'internal crash',
    })
  })
})
