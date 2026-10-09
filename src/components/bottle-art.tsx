import { useId } from 'react'
import type { BottleColor } from '../../shared/types'
const colors = { fern: ['#476f4d', '#b9cea2'], amber: ['#af774b', '#edce98'], blue: ['#567388', '#abc5d3'], rose: ['#92647a', '#dbb5c4'] }
export function BottleArt({ color = 'fern', className = '' }: { color?: BottleColor; className?: string }) {
  const id = useId().replace(/:/g, ''); const [dark, light] = colors[color]
  return <svg className={className} viewBox="0 0 160 180" aria-hidden="true"><defs><linearGradient id={id} x1="0" x2="1" y1="0" y2="1"><stop stopColor={light} stopOpacity=".8"/><stop offset="1" stopColor={dark} stopOpacity=".65"/></linearGradient></defs><ellipse cx="80" cy="164" rx="39" ry="7" fill={dark} opacity=".09"/><path d="M64 26h32v35c0 13 25 22 25 43v44c0 10-8 14-41 14s-41-4-41-14v-44c0-21 25-30 25-43z" fill={`url(#${id})`} stroke={dark} strokeOpacity=".4"/><rect x="62" y="18" width="36" height="15" rx="4" fill={dark}/><path d="M49 109c20-10 45 8 63-1v37c0 5-17 7-32 7s-31-2-31-7z" fill={dark} opacity=".16"/><rect x="48" y="93" width="64" height="42" rx="4" fill="#f8f6ee" opacity=".92"/><path d="M66 105h12v11H66zm16 0h12v11H82zm-16 15h12v11H66zm16 0h12v11H82z" fill={dark} opacity=".85"/><path d="M69 40v23c0 17-23 28-23 44" stroke="#fff" strokeOpacity=".35" strokeWidth="4" fill="none" strokeLinecap="round"/></svg>
}
