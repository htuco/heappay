import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import lottieSrc from '@/assets/dashboard-loading.lottie'

export default function DashboardLoadingOverlay() {
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
      <div className="space-y-1 text-center">
        <p className="text-lg font-semibold text-foreground">Loading...</p>
        <p className="text-sm text-muted-foreground">
          Please wait while we load your data.
        </p>
      </div>
    </div>
  )
}
