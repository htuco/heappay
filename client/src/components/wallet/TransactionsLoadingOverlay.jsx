import { useEffect, useMemo, useState } from 'react'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import lottieSrc from '@/assets/transactions-loading.lottie'

const PUNCHLINES = [
  'Fetching your transactions...',
  'Counting every last cent 🪙',
  'Shaking the piggy bank 🐷',
  'Tallying up the damage 💸',
  'Asking the bank really nicely 🙏',
  'Negotiating with your card 💳',
  'Following the money trail 🕵️',
  'Reading the fine print so you don\'t have to',
  'Snitching on your subscriptions',
  'Decoding your spending habits',
  'Rolling up the abacus 🧮',
  'Doing math the hard way',
  'Rounding up the strays...',

  'Pulling your latest statements 📄',
  'Syncing with your bank...',
  'Loading up the ledger 📒',
  'Fetching what you spent last week',
  'Importing the receipts you lost 🧾',
  'Grabbing your transaction history',
  'Waking up your account data ⏳',
  'Downloading every swipe and tap',
  'Digging through the card activity',
  'Connecting to your accounts...',
  'Unlocking the vault 🏦',

  'Running a quick liquidity check',
  'Stress-testing your budget 🧪',
  'Calculating your burn rate 🔥',
  'Checking if you\'re still solvent...',
  'Reconciling debits and credits',
  'Preparing your personal P&L 📊',
  'Marking your latte to market',
  'Amortizing last weekend over 12 months',
  'Running variance analysis on your willpower',
  'Compounding your financial clarity',
  'Auditing every impulse buy',
  'Estimating net worth (ballpark) 📈',
  'Hedging against your subscriptions',
  'Closing the books on last month',
  'Filing this under lessons learned 📁',
]

const PUNCHLINE_INTERVAL_MS = 1800

function shuffle(arr) {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export default function TransactionsLoadingOverlay() {
  const queue = useMemo(() => shuffle(PUNCHLINES), [])
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const tick = setInterval(() => {
      setIndex((i) => (i + 1) % queue.length)
    }, PUNCHLINE_INTERVAL_MS)
    return () => clearInterval(tick)
  }, [queue.length])

  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-background/85"
    >
      <div className="flex flex-col items-center justify-center text-center">
        <div className="flex h-44 w-56 items-center justify-center sm:h-52 sm:w-64">
          <DotLottieReact
            src={lottieSrc}
            loop
            autoplay
            speed={1.5}
            className="h-full w-full"
          />
        </div>
        <p
          key={index}
          className="mt-2 min-h-7 text-lg font-semibold text-foreground animate-in fade-in slide-in-from-bottom-1 duration-200 sm:text-xl"
        >
          {queue[index]}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Brewing your latest transactions...
        </p>
      </div>
    </div>
  )
}
