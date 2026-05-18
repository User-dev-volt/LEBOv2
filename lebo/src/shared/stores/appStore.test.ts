import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from './appStore'

const initialState = useAppStore.getState()

describe('appStore', () => {
  beforeEach(() => {
    useAppStore.setState(initialState, true)
  })

  it('starts with default state', () => {
    const s = useAppStore.getState()
    expect(s.isOnline).toBe(false)
    expect(s.currentView).toBe('main')
    expect(s.activePanel).toEqual({ left: 'expanded', right: 'expanded' })
  })

  it('setOnline marks app as online', () => {
    useAppStore.getState().setOnline(true)
    expect(useAppStore.getState().isOnline).toBe(true)
  })

  it('setOnline can set offline again', () => {
    useAppStore.getState().setOnline(true)
    useAppStore.getState().setOnline(false)
    expect(useAppStore.getState().isOnline).toBe(false)
  })

  it('setCurrentView switches to settings', () => {
    useAppStore.getState().setCurrentView('settings')
    expect(useAppStore.getState().currentView).toBe('settings')
  })

  it('setCurrentView switches back to main', () => {
    useAppStore.getState().setCurrentView('settings')
    useAppStore.getState().setCurrentView('main')
    expect(useAppStore.getState().currentView).toBe('main')
  })

  it('setPanelState collapses left panel only', () => {
    useAppStore.getState().setPanelState('left', 'collapsed')
    const s = useAppStore.getState()
    expect(s.activePanel.left).toBe('collapsed')
    expect(s.activePanel.right).toBe('expanded')
  })

  it('setPanelState collapses right panel only', () => {
    useAppStore.getState().setPanelState('right', 'collapsed')
    const s = useAppStore.getState()
    expect(s.activePanel.right).toBe('collapsed')
    expect(s.activePanel.left).toBe('expanded')
  })

  it('setPanelState can re-expand a collapsed panel', () => {
    useAppStore.getState().setPanelState('left', 'collapsed')
    useAppStore.getState().setPanelState('left', 'expanded')
    expect(useAppStore.getState().activePanel.left).toBe('expanded')
  })
})
