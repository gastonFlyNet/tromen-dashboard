'use client'
import { useEffect, useRef, useState } from 'react'

interface CountUpProps {
  end: number
  duration?: number   // ms
  className?: string
  prefix?: string
  suffix?: string
}

export default function CountUp({ end, duration = 1000, className, prefix = '', suffix = '' }: CountUpProps) {
  const [value, setValue] = useState(0)
  const startRef = useRef<number | null>(null)
  const rafRef = useRef<number>()

  useEffect(() => {
    startRef.current = null
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts
      const progress = Math.min((ts - startRef.current) / duration, 1)
      // easeOutQuad para que desacelere al final
      const eased = 1 - (1 - progress) * (1 - progress)
      setValue(Math.round(eased * end))
      if (progress < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [end, duration])

  return <span className={className}>{prefix}{value.toLocaleString('es-AR')}{suffix}</span>
}
