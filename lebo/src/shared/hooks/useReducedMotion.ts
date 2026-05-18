import { useState, useEffect, useRef } from 'react'

export function useReducedMotion(): boolean {
  const mqRef = useRef<MediaQueryList | null>(null)
  if (!mqRef.current) {
    mqRef.current = window.matchMedia('(prefers-reduced-motion: reduce)')
  }
  const [reducedMotion, setReducedMotion] = useState(mqRef.current.matches)
  useEffect(() => {
    const mq = mqRef.current!
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return reducedMotion
}
