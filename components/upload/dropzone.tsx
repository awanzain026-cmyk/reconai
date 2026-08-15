"use client"

import { useRef, useState, type DragEvent } from "react"
import { CheckCircle2, FileSpreadsheet, UploadCloud, X } from "lucide-react"
import { cn } from "@/lib/utils"

export function Dropzone({
  label,
  description,
  accept = ".csv",
}: {
  label: string
  description: string
  accept?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
    const dropped = event.dataTransfer.files?.[0]
    if (dropped) setFile(dropped)
  }

  return (
    <div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "mt-3 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
          isDragging ? "border-accent bg-accent/5" : "border-border hover:border-accent/50 hover:bg-secondary/40",
          file && "border-success/40 bg-success/5",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />

        {file ? (
          <>
            <CheckCircle2 className="h-7 w-7 text-success" aria-hidden="true" />
            <div>
              <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-foreground">
                <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
                {file.name}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setFile(null)
                if (inputRef.current) inputRef.current.value = ""
              }}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" aria-hidden="true" />
              Remove
            </button>
          </>
        ) : (
          <>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary">
              <UploadCloud className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Drop CSV file or click to browse</p>
              <p className="mt-0.5 text-xs text-muted-foreground">.csv up to 25MB</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
