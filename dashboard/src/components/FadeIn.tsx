'use client'
import { useEffect, useRef, useState, ReactNode, CSSProperties } from 'react'

interface FadeInProps {
  children: ReactNode
  delay?: number      // ms
  className?: string
  style?: CSSProperties
}

export default function FadeIn({ children, delay = 0, className, style }: FadeInProps) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(t)
  }, [delay])

  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...style,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
      }}>
      {children}
    </div>
  )
}
