import { useState, useCallback, useRef } from 'react'
import { PDFDocument, PDFName } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import './App.css'

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Parse a page range string like "1-3, 5, 7-10" into a sorted unique array of 0-based indices
function parsePageRange(input, totalPages) {
  const indices = new Set()
  const parts = input.split(',').map(s => s.trim()).filter(Boolean)
  for (const part of parts) {
    if (part.includes('-')) {
      const [a, b] = part.split('-').map(s => parseInt(s.trim(), 10))
      if (isNaN(a) || isNaN(b)) return null
      if (a < 1 || b > totalPages || a > b) return null
      for (let i = a; i <= b; i++) indices.add(i - 1)
    } else {
      const n = parseInt(part, 10)
      if (isNaN(n) || n < 1 || n > totalPages) return null
      indices.add(n - 1)
    }
  }
  return indices.size > 0 ? [...indices].sort((a, b) => a - b) : null
}

function validatePageRange(input, totalPages) {
  if (!input.trim()) return 'Enter a page range'
  const result = parsePageRange(input, totalPages)
  if (result === null) return `Invalid range. Use numbers 1–${totalPages}, e.g. "1-3, 5, 8-10"`
  return null
}

// ── Shared drop zone ──────────────────────────────────────────────────────────
function DropZone({ onFiles, multiple = true, label, sublabel }) {
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef(null)

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    onFiles(e.dataTransfer.files)
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
      onDragLeave={() => setIsDragOver(false)}
      className={`relative rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all duration-200
        ${isDragOver
          ? 'border-violet-400 bg-violet-50 scale-[1.01]'
          : 'border-gray-200 bg-white hover:border-violet-300 hover:bg-violet-50/50'
        }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple={multiple}
        className="hidden"
        onChange={e => onFiles(e.target.files)}
      />
      <div className={`w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center transition-colors ${isDragOver ? 'bg-violet-100' : 'bg-gray-50'}`}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={isDragOver ? '#7c3aed' : '#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 16 12 12 8 16"/>
          <line x1="12" y1="12" x2="12" y2="21"/>
          <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
        </svg>
      </div>
      <p className={`font-medium transition-colors ${isDragOver ? 'text-violet-600' : 'text-gray-600'}`}>
        {isDragOver ? 'Drop your PDF here' : label}
      </p>
      <p className="text-sm text-gray-400 mt-1">{sublabel}</p>
    </div>
  )
}

// ── Sortable file row (merge mode) ────────────────────────────────────────────
function SortableFile({ file, index, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: file.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-4 bg-white rounded-2xl px-5 py-4 border transition-all duration-200 select-none
        ${isDragging
          ? 'border-violet-400 shadow-xl shadow-violet-100 scale-[1.02] z-50 opacity-90'
          : 'border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200'
        }`}
    >
      <button
        className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing transition-colors flex-shrink-0"
        {...attributes} {...listeners}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <circle cx="7" cy="5" r="1.5" /><circle cx="13" cy="5" r="1.5" />
          <circle cx="7" cy="10" r="1.5" /><circle cx="13" cy="10" r="1.5" />
          <circle cx="7" cy="15" r="1.5" /><circle cx="13" cy="15" r="1.5" />
        </svg>
      </button>
      <span className="w-7 h-7 rounded-full bg-violet-50 text-violet-600 text-xs font-semibold flex items-center justify-center flex-shrink-0">
        {index + 1}
      </span>
      <div className="w-10 h-12 bg-gradient-to-br from-red-50 to-red-100 rounded-lg flex items-center justify-center flex-shrink-0 border border-red-100">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points="14 2 14 8 20 8" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="9" y1="15" x2="15" y2="15" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/>
          <line x1="9" y1="11" x2="15" y2="11" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
        <p className="text-xs text-gray-400 mt-0.5">{formatBytes(file.size)} · {file.pages} {file.pages === 1 ? 'page' : 'pages'}</p>
      </div>
      <button
        onClick={() => onRemove(file.id)}
        className="w-8 h-8 rounded-full hover:bg-red-50 text-gray-300 hover:text-red-400 transition-all flex items-center justify-center flex-shrink-0"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}

// ── Status banners ────────────────────────────────────────────────────────────
function StatusBanner({ status, error }) {
  if (status === 'done') return (
    <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-2xl px-5 py-4">
      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <div>
        <p className="font-semibold text-sm">Done! Your download should start automatically.</p>
      </div>
    </div>
  )
  if (status === 'error') return (
    <div className="flex items-center gap-3 bg-red-50 border border-red-100 text-red-700 rounded-2xl px-5 py-4">
      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <div>
        <p className="font-semibold text-sm">Failed</p>
        <p className="text-xs text-red-500 mt-0.5">{error}</p>
      </div>
    </div>
  )
  return null
}

function ActionButton({ onClick, disabled, loading, label, loadingLabel }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-3.5 rounded-xl font-semibold text-white text-sm transition-all duration-200 flex items-center justify-center gap-2
        ${disabled
          ? 'bg-violet-400 cursor-not-allowed'
          : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-md hover:shadow-lg shadow-violet-200 hover:scale-[1.01] active:scale-[0.99]'
        }`}
    >
      {loading ? (
        <>
          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          {loadingLabel}
        </>
      ) : (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          {label}
        </>
      )}
    </button>
  )
}

function OutputNameInput({ value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        Output filename
      </label>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1 text-sm border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 transition-all text-gray-700"
          placeholder="output"
        />
        <span className="text-sm text-gray-400 font-medium">.pdf</span>
      </div>
    </div>
  )
}

function downloadBlob(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Merge mode ────────────────────────────────────────────────────────────────
function MergeMode() {
  const [files, setFiles] = useState([])
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [outputName, setOutputName] = useState('merged')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const readPdfPages = async (file) => {
    try {
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
      return doc.getPageCount()
    } catch { return '?' }
  }

  const addFiles = useCallback(async (newFiles) => {
    const pdfs = Array.from(newFiles).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'))
    if (!pdfs.length) return
    const entries = await Promise.all(pdfs.map(async f => ({
      id: `${f.name}-${f.lastModified}-${Math.random()}`,
      name: f.name, size: f.size, file: f,
      pages: await readPdfPages(f),
    })))
    setFiles(prev => [...prev, ...entries])
    setStatus(null)
  }, [])

  const handleDragEnd = ({ active, over }) => {
    if (active.id !== over?.id) {
      setFiles(prev => {
        const oi = prev.findIndex(f => f.id === active.id)
        const ni = prev.findIndex(f => f.id === over.id)
        return arrayMove(prev, oi, ni)
      })
    }
  }

  const mergePdfs = async () => {
    setStatus('merging'); setError('')
    try {
      const merged = await PDFDocument.create()
      for (const entry of files) {
        const doc = await PDFDocument.load(await entry.file.arrayBuffer(), { ignoreEncryption: true })
        const pages = await merged.copyPages(doc, doc.getPageIndices())
        pages.forEach(p => merged.addPage(p))
      }
      downloadBlob(await merged.save(), `${outputName.trim() || 'merged'}.pdf`)
      setStatus('done')
    } catch (e) { setError(e.message); setStatus('error') }
  }

  const totalPages = files.reduce((s, f) => s + (typeof f.pages === 'number' ? f.pages : 0), 0)
  const totalSize = files.reduce((s, f) => s + f.size, 0)

  return (
    <div className="space-y-4">
      <DropZone
        onFiles={addFiles}
        multiple
        label="Drop PDFs here or click to browse"
        sublabel="Supports multiple PDF files"
      />

      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500"><span className="font-semibold text-gray-700">{files.length}</span> file{files.length !== 1 ? 's' : ''}</span>
              {totalPages > 0 && <><span className="text-gray-300">·</span><span className="text-sm text-gray-500"><span className="font-semibold text-gray-700">{totalPages}</span> pages total</span></>}
              <span className="text-gray-300">·</span>
              <span className="text-sm text-gray-500"><span className="font-semibold text-gray-700">{formatBytes(totalSize)}</span></span>
            </div>
            <button onClick={() => { setFiles([]); setStatus(null) }} className="text-xs text-gray-400 hover:text-red-400 transition-colors font-medium">Clear all</button>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={files.map(f => f.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {files.map((file, i) => (
                  <SortableFile key={file.id} file={file} index={i} onRemove={id => setFiles(p => p.filter(f => f.id !== id))} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {files.length >= 2 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <OutputNameInput value={outputName} onChange={setOutputName} />
          <ActionButton
            onClick={mergePdfs}
            disabled={status === 'merging'}
            loading={status === 'merging'}
            label="Merge & Download"
            loadingLabel="Merging PDFs…"
          />
        </div>
      )}

      {files.length === 1 && <p className="text-center text-sm text-gray-400 py-2">Add at least one more PDF to merge</p>}

      <StatusBanner status={status} error={error} />
    </div>
  )
}

// ── Extract mode ──────────────────────────────────────────────────────────────
function ExtractMode() {
  const [pdfFile, setPdfFile] = useState(null)
  const [pageCount, setPageCount] = useState(0)
  const [rangeInput, setRangeInput] = useState('')
  const [rangeError, setRangeError] = useState('')
  const [outputName, setOutputName] = useState('extracted')
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')

  const loadFile = useCallback(async (files) => {
    const f = Array.from(files).find(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'))
    if (!f) return
    try {
      const doc = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true })
      setPdfFile(f)
      setPageCount(doc.getPageCount())
      setRangeInput('')
      setRangeError('')
      setStatus(null)
      const base = f.name.replace(/\.pdf$/i, '')
      setOutputName(`${base}-extracted`)
    } catch (e) {
      setError(`Could not read PDF: ${e.message}`)
      setStatus('error')
    }
  }, [])

  const handleRangeChange = (val) => {
    setRangeInput(val)
    if (val.trim()) setRangeError(validatePageRange(val, pageCount) || '')
    else setRangeError('')
    setStatus(null)
  }

  const extractPages = async () => {
    const err = validatePageRange(rangeInput, pageCount)
    if (err) { setRangeError(err); return }

    setStatus('extracting'); setError('')
    try {
      const indices = parsePageRange(rangeInput, pageCount)
      const srcDoc = await PDFDocument.load(await pdfFile.arrayBuffer(), { ignoreEncryption: true })
      const newDoc = await PDFDocument.create()
      const copied = await newDoc.copyPages(srcDoc, indices)
      copied.forEach(p => newDoc.addPage(p))
      downloadBlob(await newDoc.save(), `${outputName.trim() || 'extracted'}.pdf`)
      setStatus('done')
    } catch (e) { setError(e.message); setStatus('error') }
  }

  const clear = () => {
    setPdfFile(null); setPageCount(0); setRangeInput('')
    setRangeError(''); setStatus(null); setError('')
    setOutputName('extracted')
  }

  // Build a visual preview of selected pages
  const selectedPages = rangeInput.trim() && !rangeError && pageCount
    ? parsePageRange(rangeInput, pageCount)
    : null

  return (
    <div className="space-y-4">
      {!pdfFile ? (
        <DropZone
          onFiles={loadFile}
          multiple={false}
          label="Drop a PDF here or click to browse"
          sublabel="Select one PDF to extract pages from"
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
          <div className="w-10 h-12 bg-gradient-to-br from-red-50 to-red-100 rounded-lg flex items-center justify-center flex-shrink-0 border border-red-100">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="14 2 14 8 20 8" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{pdfFile.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{formatBytes(pdfFile.size)} · {pageCount} pages</p>
          </div>
          <button onClick={clear} className="w-8 h-8 rounded-full hover:bg-red-50 text-gray-300 hover:text-red-400 transition-all flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {pdfFile && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
          {/* Page range input */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Page range
            </label>
            <input
              type="text"
              value={rangeInput}
              onChange={e => handleRangeChange(e.target.value)}
              placeholder={`e.g. 1-3, 5, 8-${Math.min(pageCount, 10)}`}
              className={`w-full text-sm border rounded-xl px-4 py-2.5 outline-none transition-all text-gray-700
                ${rangeError
                  ? 'border-red-300 focus:ring-2 focus:ring-red-200 focus:border-red-400'
                  : 'border-gray-200 focus:ring-2 focus:ring-violet-300 focus:border-violet-400'
                }`}
            />
            {rangeError ? (
              <p className="text-xs text-red-500 mt-1.5">{rangeError}</p>
            ) : (
              <p className="text-xs text-gray-400 mt-1.5">
                Use commas to separate pages or ranges · PDF has <span className="font-medium text-gray-600">{pageCount}</span> pages
              </p>
            )}
          </div>

          {/* Selected pages preview */}
          {selectedPages && selectedPages.length > 0 && (
            <div className="bg-violet-50 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-violet-600 uppercase tracking-wider mb-2">
                {selectedPages.length} page{selectedPages.length !== 1 ? 's' : ''} selected
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selectedPages.slice(0, 40).map(i => (
                  <span key={i} className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white border border-violet-200 text-violet-700 text-xs font-medium shadow-sm">
                    {i + 1}
                  </span>
                ))}
                {selectedPages.length > 40 && (
                  <span className="inline-flex items-center px-2 h-7 rounded-lg bg-white border border-violet-200 text-violet-500 text-xs">
                    +{selectedPages.length - 40} more
                  </span>
                )}
              </div>
            </div>
          )}

          <OutputNameInput value={outputName} onChange={setOutputName} />

          <ActionButton
            onClick={extractPages}
            disabled={!rangeInput.trim() || !!rangeError || status === 'extracting'}
            loading={status === 'extracting'}
            label="Extract & Download"
            loadingLabel="Extracting pages…"
          />
        </div>
      )}

      <StatusBanner status={status} error={error} />
    </div>
  )
}

// ── Compress mode ─────────────────────────────────────────────────────────────
const COMPRESS_LEVELS = [
  {
    id: 'screen',
    label: 'Screen',
    desc: '72 DPI · JPEG 50%',
    detail: 'Smallest file. Good for sharing on screen, not for printing.',
    scale: 1.0,
    quality: 0.50,
  },
  {
    id: 'ebook',
    label: 'eBook',
    desc: '108 DPI · JPEG 65%',
    detail: 'Balanced — readable on screens and tablets, decent print quality.',
    scale: 1.5,
    quality: 0.65,
  },
  {
    id: 'printer',
    label: 'Printer',
    desc: '150 DPI · JPEG 82%',
    detail: 'Best quality. Still reduces file size, suitable for printing.',
    scale: 2.083,
    quality: 0.82,
  },
]

async function runCompression(file, levelId, onProgress) {
  const cfg = COMPRESS_LEVELS.find(l => l.id === levelId)
  const arrayBuffer = await file.arrayBuffer()

  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
  const pdfJsDoc = await loadingTask.promise
  const numPages = pdfJsDoc.numPages

  const newDoc = await PDFDocument.create()

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    onProgress(pageNum, numPages)
    const page = await pdfJsDoc.getPage(pageNum)
    const viewport = page.getViewport({ scale: cfg.scale })

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    const ctx = canvas.getContext('2d')

    await page.render({ canvasContext: ctx, viewport }).promise

    // Re-encode as JPEG
    const dataUrl = canvas.toDataURL('image/jpeg', cfg.quality)
    const b64 = dataUrl.split(',')[1]
    const jpegBytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))

    const img = await newDoc.embedJpg(jpegBytes)
    const newPage = newDoc.addPage([canvas.width, canvas.height])
    newPage.drawImage(img, { x: 0, y: 0, width: canvas.width, height: canvas.height })
  }

  return newDoc.save({ useObjectStreams: true })
}

function SizeDiff({ original, compressed }) {
  const saved = original - compressed
  const pct = Math.round((saved / original) * 100)
  const grew = saved < 0
  return (
    <div className="grid grid-cols-3 gap-3 text-center">
      <div className="bg-gray-50 rounded-xl p-3">
        <p className="text-xs text-gray-400 mb-1">Original</p>
        <p className="text-sm font-semibold text-gray-700">{formatBytes(original)}</p>
      </div>
      <div className={`rounded-xl p-3 ${grew ? 'bg-amber-50' : 'bg-emerald-50'}`}>
        <p className={`text-xs mb-1 ${grew ? 'text-amber-500' : 'text-emerald-500'}`}>{grew ? 'Grew' : 'Saved'}</p>
        <p className={`text-sm font-semibold ${grew ? 'text-amber-600' : 'text-emerald-600'}`}>
          {grew ? '+' : '-'}{formatBytes(Math.abs(saved))}
        </p>
      </div>
      <div className={`rounded-xl p-3 ${grew ? 'bg-amber-50' : 'bg-emerald-50'}`}>
        <p className={`text-xs mb-1 ${grew ? 'text-amber-500' : 'text-emerald-500'}`}>Reduction</p>
        <p className={`text-sm font-semibold ${grew ? 'text-amber-600' : 'text-emerald-600'}`}>
          {grew ? `+${Math.abs(pct)}` : pct}%
        </p>
      </div>
      <div className="col-span-3 bg-gray-50 rounded-xl p-3">
        <p className="text-xs text-gray-400 mb-1">Compressed size</p>
        <p className="text-sm font-semibold text-gray-700">{formatBytes(compressed)}</p>
      </div>
    </div>
  )
}

function CompressMode() {
  const [pdfFile, setPdfFile] = useState(null)
  const [pageCount, setPageCount] = useState(0)
  const [level, setLevel] = useState('ebook')
  const [outputName, setOutputName] = useState('compressed')
  const [status, setStatus] = useState(null) // null | 'compressing' | 'done' | 'error'
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const loadFile = useCallback(async (files) => {
    const f = Array.from(files).find(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'))
    if (!f) return
    try {
      const loadingTask = pdfjsLib.getDocument({ data: await f.arrayBuffer() })
      const doc = await loadingTask.promise
      setPdfFile(f)
      setPageCount(doc.numPages)
      setStatus(null); setResult(null)
      setOutputName(f.name.replace(/\.pdf$/i, '') + '-compressed')
    } catch (e) { setError(`Could not read PDF: ${e.message}`); setStatus('error') }
  }, [])

  const clear = () => {
    setPdfFile(null); setPageCount(0); setStatus(null)
    setResult(null); setError(''); setOutputName('compressed')
    setProgress({ current: 0, total: 0 })
  }

  const compress = async () => {
    setStatus('compressing'); setError(''); setResult(null)
    setProgress({ current: 0, total: pageCount })
    try {
      const bytes = await runCompression(pdfFile, level, (cur, tot) =>
        setProgress({ current: cur, total: tot })
      )
      setResult({ original: pdfFile.size, compressed: bytes.length })
      downloadBlob(bytes, `${outputName.trim() || 'compressed'}.pdf`)
      setStatus('done')
    } catch (e) { setError(e.message); setStatus('error') }
  }

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <div className="space-y-4">
      {!pdfFile ? (
        <DropZone
          onFiles={loadFile}
          multiple={false}
          label="Drop a PDF here or click to browse"
          sublabel="Select one PDF to compress"
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
          <div className="w-10 h-12 bg-gradient-to-br from-red-50 to-red-100 rounded-lg flex items-center justify-center flex-shrink-0 border border-red-100">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="14 2 14 8 20 8" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{pdfFile.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{formatBytes(pdfFile.size)} · {pageCount} pages</p>
          </div>
          <button onClick={clear} disabled={status === 'compressing'} className="w-8 h-8 rounded-full hover:bg-red-50 text-gray-300 hover:text-red-400 transition-all flex items-center justify-center flex-shrink-0 disabled:opacity-30">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {pdfFile && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
          {/* Quality preset picker */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Quality preset
            </label>
            <div className="space-y-2">
              {COMPRESS_LEVELS.map(l => (
                <button
                  key={l.id}
                  onClick={() => { setLevel(l.id); setStatus(null); setResult(null) }}
                  disabled={status === 'compressing'}
                  className={`w-full flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all duration-150 disabled:opacity-50
                    ${level === l.id
                      ? 'border-violet-300 bg-violet-50 ring-1 ring-violet-300'
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors
                    ${level === l.id ? 'border-violet-500' : 'border-gray-300'}`}>
                    {level === l.id && <div className="w-2 h-2 rounded-full bg-violet-500" />}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${level === l.id ? 'text-violet-700' : 'text-gray-700'}`}>
                      {l.label}
                      <span className={`ml-2 text-xs font-mono font-normal ${level === l.id ? 'text-violet-400' : 'text-gray-400'}`}>
                        {l.desc}
                      </span>
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{l.detail}</p>
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2 mt-3">
              Pages are rasterised to images — text will not be selectable in the output.
            </p>
          </div>

          <OutputNameInput value={outputName} onChange={setOutputName} />

          {/* Progress bar */}
          {status === 'compressing' && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-gray-400">
                <span>Rendering page {progress.current} of {progress.total}</span>
                <span>{pct}%</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          <ActionButton
            onClick={compress}
            disabled={status === 'compressing'}
            loading={status === 'compressing'}
            label="Compress & Download"
            loadingLabel="Compressing…"
          />
        </div>
      )}

      {status === 'done' && result && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Results</p>
          <SizeDiff original={result.original} compressed={result.compressed} />
        </div>
      )}

      {status === 'error' && <StatusBanner status="error" error={error} />}
    </div>
  )
}

// ── App shell ─────────────────────────────────────────────────────────────────
export default function App() {
  const [mode, setMode] = useState('merge')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/30 to-indigo-50/40 flex flex-col items-center justify-start p-6 pt-14">

      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-200 mb-5">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
        </div>
        <h1 className="text-4xl font-bold text-gray-900 tracking-tight">PDFit</h1>
        <p className="text-gray-500 mt-2 text-base">Everything runs in your browser — files never leave your device.</p>
      </div>

      <div className="w-full max-w-2xl space-y-6">

        {/* Mode tabs */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-1.5 flex gap-1">
          <button
            onClick={() => setMode('merge')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all duration-200
              ${mode === 'merge'
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-200'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
            </svg>
            Merge
          </button>
          <button
            onClick={() => setMode('extract')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all duration-200
              ${mode === 'extract'
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-200'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Extract Pages
          </button>
          <button
            onClick={() => setMode('compress')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all duration-200
              ${mode === 'compress'
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-200'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>
              <line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
            Compress
          </button>
        </div>

        {/* Mode content */}
        {mode === 'merge' && <MergeMode />}
        {mode === 'extract' && <ExtractMode />}
        {mode === 'compress' && <CompressMode />}
      </div>

      <p className="text-xs text-gray-300 mt-12 pb-8">Powered by pdf-lib · No uploads, no servers</p>
    </div>
  )
}
