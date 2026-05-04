export default function AdminDemoToast({ message }) {
  if (!message) return null

  return (
    <div className="fixed bottom-5 right-5 z-50 rounded-xl border border-border bg-card px-4 py-3 text-sm text-card-foreground shadow-lg">
      {message}
    </div>
  )
}
