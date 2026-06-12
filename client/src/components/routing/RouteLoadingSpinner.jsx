export default function RouteLoadingSpinner() {
  return (
    <div className="flex h-screen items-center justify-center">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
}
