'use client'
import { ButtonHTMLAttributes, ReactNode } from 'react'

interface AnimatedButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
}

export default function AnimatedButton({ children, className, style, ...props }: AnimatedButtonProps) {
  return (
    <button
      {...props}
      className={'cult-btn ' + (className ?? '')}
      style={style}>
      {children}
    </button>
  )
}
