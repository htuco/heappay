import { useCallback, useEffect, useRef, useState } from 'react'
import { FolderOpen, ImagePlus } from 'lucide-react'

import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import FormBanner from '@/components/ui/FormBanner'
import { cn } from '@/lib/utils'

const ACCEPT = 'image/jpeg,image/png,image/webp'
const ACCEPT_LABEL = 'JPEG, PNG, or WebP'
const MAX_BYTES = 5 * 1024 * 1024

function validateFile(file) {
  if (!file) return 'Choose an image file.'
  const okType = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
  if (!okType) return `Use ${ACCEPT_LABEL.toLowerCase()}.`
  if (file.size > MAX_BYTES) return 'Image must be 5 MB or smaller.'
  return null
}

export default function AvatarUploadModal({ isOpen, onClose, onUpload }) {
  const inputRef = useRef(null)
  const objectUrlRef = useRef(null)
  const dragDepth = useRef(0)
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const revokePreview = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    setPreviewUrl(null)
    setSelectedFile(null)
  }, [])

  const resetUi = useCallback(() => {
    dragDepth.current = 0
    setDragActive(false)
    setError('')
    setLoading(false)
    if (inputRef.current) inputRef.current.value = ''
  }, [])

  useEffect(() => {
    if (!isOpen) {
      revokePreview()
      resetUi()
    }
  }, [isOpen, revokePreview, resetUi])

  const pickFile = (file) => {
    const msg = validateFile(file)
    if (msg) {
      setError(msg)
      revokePreview()
      return
    }
    setError('')
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    setPreviewUrl(url)
    setSelectedFile(file)
  }

  const handleClose = () => {
    revokePreview()
    resetUi()
    onClose()
  }

  const handleInputChange = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) pickFile(file)
  }

  const handleDragEnter = (e) => {
    e.preventDefault()
    e.stopPropagation()
    dragDepth.current += 1
    setDragActive(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    dragDepth.current -= 1
    if (dragDepth.current <= 0) {
      dragDepth.current = 0
      setDragActive(false)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    dragDepth.current = 0
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file) pickFile(file)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedFile || loading) return
    setLoading(true)
    setError('')
    try {
      await onUpload(selectedFile)
      handleClose()
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Upload failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const openPicker = () => inputRef.current?.click()

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Update profile photo" size="lg">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <p className="text-sm text-muted-foreground">
          Drag and drop an image here, or browse your device. {ACCEPT_LABEL}, max 5 MB.
        </p>

        <FormBanner variant="error" message={error} />

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          onChange={handleInputChange}
        />

        <div
          role="presentation"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={cn(
            'rounded-2xl border-2 border-dashed px-4 py-10 text-center transition-colors',
            'bg-emphasis border-border',
            dragActive && 'border-primary bg-primary/5 ring-2 ring-primary/20',
            !dragActive && 'hover:border-primary/35 hover:bg-muted/30',
          )}
        >
          {previewUrl && selectedFile ? (
            <div className="mx-auto flex max-w-xs flex-col items-center gap-4">
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm ring-1 ring-border/60">
                <img
                  src={previewUrl}
                  alt="Selected preview"
                  className="max-h-48 w-full max-w-xs object-contain"
                />
              </div>
              <p className="truncate text-xs font-medium text-card-foreground" title={selectedFile.name}>
                {selectedFile.name}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={openPicker} disabled={loading}>
                Choose a different file
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-primary/15 to-primary-light/20 text-primary">
                <ImagePlus className="h-7 w-7" strokeWidth={1.75} aria-hidden />
              </span>
              <p className="text-sm font-semibold text-card-foreground">Drop your image here</p>
              <p className="text-xs text-muted-foreground">or</p>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={openPicker}
                disabled={loading}
              >
                <FolderOpen className="h-4 w-4" aria-hidden />
                Open folder
              </Button>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={!selectedFile || loading}>
            {loading ? 'Uploading…' : 'Save photo'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
