import { useEffect, useMemo, useState } from 'react'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import lottieSrc from '@/assets/dashboard-loading.lottie'

const MESSAGES = [
  'Syncing your cards...',
  'Counting your money (accurately 😉)',
  'Preparing your financial overview...',
  'Loading your wallet...',
  'Almost ready. Just balancing things.',
  'Crunching numbers...',
  'Organizing your finances...',
  'Fetching latest transactions...',
  'Updating your balances...',
  'Getting everything in order...',
  'One moment.',
  'Just a second.',
  'Preparing dashboard...',
  'Making your money behave.',
  'Good things take milliseconds.',
  'Your finances, getting organized.',
  'Putting your cards in order.',
  'Loading your data...',
  'Almost there...',
  'Finalizing everything for you.',
]

const MESSAGE_INTERVAL_MS = 1800

function shuffle(arr) {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export default function DashboardLoadingOverlay() {
  const queue = useMemo(() => shuffle(MESSAGES), [])
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const tick = setInterval(() => {
      setIndex((i) => (i + 1) % queue.length)
    }, MESSAGE_INTERVAL_MS)
    return () => clearInterval(tick)
  }, [queue.length])

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/85"
    >
      <DotLottieReact
        src={lottieSrc}
        loop
        autoplay
        speed={2.5}
        className="h-48 w-48 sm:h-56 sm:w-56"
      />
      <div className="space-y-1 overflow-hidden text-center">
        <p
          key={index}
          className="text-lg font-semibold text-foreground animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          {queue[index]}
        </p>
        <p className="text-sm text-muted-foreground">
          Please wait while we load your data.
        </p>
      </div>
    </div>
  )
}
