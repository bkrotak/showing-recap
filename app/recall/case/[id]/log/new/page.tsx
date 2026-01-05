'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createLog, createPhoto } from '@/lib/recall/supabase'
import { uploadPhotos } from '@/lib/recall/storage'
import { LogType } from '@/lib/recall/types'

interface NewLogPageProps {
  params: { id: string }
}

const LOG_TYPES: LogType[] = ['Before', 'During', 'After', 'Issue', 'Resolution', 'Call', 'Visit', 'General']

export default function NewLogPage({ params }: NewLogPageProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [logType, setLogType] = useState<LogType>('General')
  const [note, setNote] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    
    // Validate files
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        setError('Only image files are allowed')
        return false
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('Files must be less than 5MB each')
        return false
      }
      return true
    })

    if (selectedFiles.length + validFiles.length > 8) {
      setError('Maximum 8 photos per log')
      return
    }

    setSelectedFiles(prev => [...prev, ...validFiles])
    setError('')
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!note.trim() && selectedFiles.length === 0) {
      setError('Please add a note or photos')
      return
    }

    setLoading(true)
    setError('')
    setUploadProgress(0)

    try {
      // Create log entry
      const log = await createLog({
        case_id: params.id,
        log_type: logType,
        note: note.trim()
      })

      // Upload photos if any
      if (selectedFiles.length > 0) {
        const uploadResults = await uploadPhotos(
          selectedFiles, 
          params.id, 
          log.id,
          (current, total) => {
            setUploadProgress((current / total) * 100)
          }
        )

        // Create photo records
        for (let i = 0; i < uploadResults.length; i++) {
          const result = uploadResults[i]
          const file = selectedFiles[i]
          await createPhoto(log.id, result.path, file.name)
        }
      }

      router.push(`/recall/case/${params.id}`)
    } catch (err) {
      console.error('Error creating log:', err)
      setError('Failed to create log. Please try again.')
    } finally {
      setLoading(false)
      setUploadProgress(0)
    }
  }

  const getFilePreview = (file: File): string => {
    return URL.createObjectURL(file)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link 
                href={`/recall/case/${params.id}`}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-xl font-semibold text-gray-900">New Log</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-md mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Log Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Log Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {LOG_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setLogType(type)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    logType === type
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="note" className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Describe what happened, what you observed, or any important details..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              maxLength={1000}
            />
            <div className="text-right text-xs text-gray-500 mt-1">
              {note.length}/1000
            </div>
          </div>

          {/* Photo Upload */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Photos ({selectedFiles.length}/8)
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={selectedFiles.length >= 8}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium disabled:text-gray-400"
              >
                + Add Photos
              </button>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Photo Previews */}
            {selectedFiles.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="relative">
                    <img
                      src={getFilePreview(file)}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 text-xs"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Hint */}
            {selectedFiles.length === 0 && (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer"
              >
                <div className="text-gray-400 mb-2">
                  <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className="text-gray-600 text-sm">Tap to add photos</p>
                <p className="text-gray-500 text-xs mt-1">Camera or gallery • Max 5MB each</p>
              </div>
            )}
          </div>

          {/* Upload Progress */}
          {loading && uploadProgress > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-blue-800">Uploading photos...</span>
                <span className="text-sm text-blue-600">{Math.round(uploadProgress)}%</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || (!note.trim() && selectedFiles.length === 0)}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-4 px-6 rounded-lg text-lg transition-colors"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                {uploadProgress > 0 ? 'Uploading...' : 'Saving...'}
              </div>
            ) : (
              'Save Log'
            )}
          </button>

          {/* Cancel Button */}
          <Link
            href={`/recall/case/${params.id}`}
            className="block w-full text-center bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-6 rounded-lg transition-colors"
          >
            Cancel
          </Link>
        </form>
      </div>

      {/* Tips */}
      <div className="max-w-md mx-auto px-4 pb-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">📝 Best Practices</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Take photos before, during, and after work</li>
            <li>• Include detailed notes for clarity</li>
            <li>• Use appropriate log types for organization</li>
            <li>• Document issues and their resolutions</li>
          </ul>
        </div>
      </div>
    </div>
  )
}