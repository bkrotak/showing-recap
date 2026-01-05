'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import type { Showing, FeedbackStatus } from '@/lib/types'

interface PhotoPreview {
  file: File
  url: string
  id: string
}

export default function BuyerRecapPage() {
  const params = useParams()
  const token = params.token as string
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [showing, setShowing] = useState<Showing | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({})
  const [feedback, setFeedback] = useState<{
    status?: FeedbackStatus
    note: string
  }>({ note: '' })
  const [photoPreview, setPhotoPreview] = useState<PhotoPreview[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  useEffect(() => {
    if (token) {
      loadShowing()
    }
  }, [token])

  const loadShowing = async () => {
    const { data, error } = await supabase
      .from('showings')
      .select('*')
      .eq('public_token', token)
      .single()

    if (error || !data) {
      console.error('Error loading showing:', error)
      setShowing(null)
    } else {
      setShowing(data)
      if (data.feedback_submitted_at) {
        setSubmitted(true)
        setFeedback({
          status: data.feedback_status,
          note: data.feedback_note || ''
        })
      }
    }
    setLoading(false)
  }

  const validateFiles = (files: FileList): File[] => {
    const validFiles: File[] = []
    const newErrors: { [key: string]: string } = {}

    Array.from(files).forEach((file, index) => {
      // Check file type
      if (!file.type.startsWith('image/')) {
        newErrors[`file_${index}`] = `${file.name} is not an image file`
        return
      }

      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        newErrors[`file_${index}`] = `${file.name} is too large (max 10MB)`
        return
      }

      // Check file format (jpg, jpeg, png only)
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png']
      if (!allowedTypes.includes(file.type)) {
        newErrors[`file_${index}`] = `${file.name} must be JPG or PNG format`
        return
      }

      validFiles.push(file)
    })

    // Check total count (max 10)
    if (validFiles.length + photoPreview.length > 10) {
      newErrors.total = `Maximum 10 photos allowed (you have ${photoPreview.length} already)`
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0 ? validFiles : []
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const validFiles = validateFiles(e.target.files)
      
      if (validFiles.length > 0) {
        const newPreviews: PhotoPreview[] = validFiles.slice(0, 10 - photoPreview.length).map(file => ({
          file,
          url: URL.createObjectURL(file),
          id: crypto.randomUUID()
        }))
        
        setPhotoPreview(prev => [...prev, ...newPreviews])
      }
      
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const removePhoto = (photoId: string) => {
    setPhotoPreview(prev => {
      const updated = prev.filter(p => p.id !== photoId)
      // Clean up object URL to prevent memory leaks
      const removed = prev.find(p => p.id === photoId)
      if (removed) {
        URL.revokeObjectURL(removed.url)
      }
      return updated
    })
    // Clear any file-related errors
    setErrors(prev => {
      const updated = { ...prev }
      Object.keys(updated).forEach(key => {
        if (key.startsWith('file_')) {
          delete updated[key]
        }
      })
      return updated
    })
  }

  const uploadPhotos = async (showingId: string): Promise<boolean> => {
    if (photoPreview.length === 0) return true

    try {
      const uploadPromises = photoPreview.map(async (preview) => {
        const fileExt = preview.file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const fileName = `${crypto.randomUUID()}.${fileExt}`
        const filePath = `${showingId}/${fileName}`

        setUploadProgress(prev => ({ ...prev, [preview.id]: 0 }))

        const { error: uploadError } = await supabase.storage
          .from('showing-photos')
          .upload(filePath, preview.file, {
            cacheControl: '3600',
            upsert: false
          })

        if (uploadError) {
          console.error('Error uploading photo:', uploadError)
          throw new Error(`Failed to upload ${preview.file.name}`)
        }

        setUploadProgress(prev => ({ ...prev, [preview.id]: 50 }))

        // Save photo metadata
        const { error: metadataError } = await supabase
          .from('showing_photos')
          .insert({
            showing_id: showingId,
            storage_path: filePath,
            original_name: preview.file.name,
            file_size: preview.file.size,
            mime_type: preview.file.type
          })

        if (metadataError) {
          console.error('Error saving photo metadata:', metadataError)
          throw new Error(`Failed to save ${preview.file.name} metadata`)
        }

        setUploadProgress(prev => ({ ...prev, [preview.id]: 100 }))
        return filePath
      })

      await Promise.all(uploadPromises)
      return true
    } catch (error) {
      console.error('Photo upload error:', error)
      throw error
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showing || !feedback.status) {
      setErrors({ form: 'Please select your feedback option' })
      return
    }

    setSubmitting(true)
    setErrors({})

    try {
      // Upload photos first if any
      if (photoPreview.length > 0) {
        await uploadPhotos(showing.id)
      }

      // Update feedback using the security definer function
      const { data, error } = await supabase.rpc('update_showing_feedback', {
        token: showing.public_token,
        status: feedback.status,
        note: feedback.note.trim() || null
      })

      if (error) {
        console.error('Error submitting feedback:', error)
        throw new Error('Failed to submit feedback')
      }

      if (!data) {
        throw new Error('Invalid showing link')
      }

      // Clean up photo preview URLs
      photoPreview.forEach(preview => {
        URL.revokeObjectURL(preview.url)
      })

      setSubmitted(true)
    } catch (error) {
      console.error('Error:', error)
      setErrors({ 
        form: error instanceof Error ? error.message : 'Error submitting feedback' 
      })
    }

    setSubmitting(false)
  }

  const formatDateTime = (dateTime: string) => {
    const date = new Date(dateTime)
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      photoPreview.forEach(preview => {
        URL.revokeObjectURL(preview.url)
      })
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">Loading showing details...</div>
        </div>
      </div>
    )
  }

  if (!showing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-6xl mb-4">🏠</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Showing Not Found</h1>
          <p className="text-gray-600">
            The showing link you're looking for doesn't exist or has expired.
          </p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
            <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-green-600 mb-4">Thank You!</h2>
          <p className="text-gray-600 mb-4">
            Your feedback has been submitted for the showing at:
          </p>
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <p className="font-medium text-gray-900 mb-2">
              {showing.address}
            </p>
            <p className="text-gray-600 text-sm">
              {showing.city}, {showing.state} {showing.zip}
            </p>
          </div>
          <div className="space-y-3">
            <div className={`inline-flex px-4 py-2 rounded-full text-sm font-medium ${
              feedback.status === 'INTERESTED' ? 'bg-green-100 text-green-800 border border-green-200' :
              feedback.status === 'NOT_FOR_US' ? 'bg-red-100 text-red-800 border border-red-200' :
              'bg-yellow-100 text-yellow-800 border border-yellow-200'
            }`}>
              {feedback.status === 'INTERESTED' ? '👍 Interested' :
               feedback.status === 'NOT_FOR_US' ? '👎 Not for us' :
               '🤔 Maybe'}
            </div>
            {feedback.note && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg text-left">
                <p className="text-sm text-gray-700 font-medium mb-1">Your note:</p>
                <p className="text-sm text-gray-600">{feedback.note}</p>
              </div>
            )}
            {photoPreview.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  📸 {photoPreview.length} photo{photoPreview.length > 1 ? 's' : ''} uploaded
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="px-6 py-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <h1 className="text-2xl font-bold text-gray-900">Property Showing Feedback</h1>
                <p className="text-sm text-gray-600 mt-1">Please share your thoughts about this property</p>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-lg font-semibold text-gray-900 mb-2">
                {showing.address}
              </p>
              <p className="text-gray-600 mb-2">
                {showing.city}, {showing.state} {showing.zip}
              </p>
              <div className="flex items-center text-sm text-gray-500">
                <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Shown on {formatDateTime(showing.showing_datetime)}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-8">
            {errors.form && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="ml-3 text-sm text-red-700">{errors.form}</p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-lg font-semibold text-gray-900 mb-4">
                How do you feel about this property? *
              </label>
              <div className="space-y-4">
                {([
                  { value: 'INTERESTED', label: 'Interested', emoji: '👍', description: "I'd like to learn more or make an offer", color: 'green' },
                  { value: 'MAYBE', label: 'Maybe', emoji: '🤔', description: "I'm considering it but need to think more", color: 'yellow' },
                  { value: 'NOT_FOR_US', label: 'Not for us', emoji: '👎', description: "This property isn't what we're looking for", color: 'red' }
                ] as const).map((option) => (
                  <label key={option.value} className={`relative flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50 ${
                    feedback.status === option.value
                      ? option.color === 'green' ? 'border-green-300 bg-green-50' :
                        option.color === 'yellow' ? 'border-yellow-300 bg-yellow-50' :
                        'border-red-300 bg-red-50'
                      : 'border-gray-200'
                  }`}>
                    <input
                      type="radio"
                      name="feedback_status"
                      value={option.value}
                      checked={feedback.status === option.value}
                      onChange={(e) => setFeedback({ ...feedback, status: e.target.value as FeedbackStatus })}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="ml-3 flex-1">
                      <div className="flex items-center">
                        <span className="text-2xl mr-2">{option.emoji}</span>
                        <span className="text-lg font-medium text-gray-900">{option.label}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-lg font-semibold text-gray-900 mb-2">
                Additional Comments (Optional)
              </label>
              <textarea
                value={feedback.note}
                onChange={(e) => setFeedback({ ...feedback, note: e.target.value })}
                placeholder="What did you think of the property? Any specific likes, dislikes, or questions?"
                maxLength={280}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
              <div className="flex justify-between mt-2">
                <p className="text-sm text-gray-500">
                  Share your thoughts, questions, or concerns
                </p>
                <p className="text-sm text-gray-400">
                  {feedback.note.length}/280
                </p>
              </div>
            </div>

            <div>
              <label className="block text-lg font-semibold text-gray-900 mb-4">
                Photos (Optional, up to 10)
              </label>
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <div className="text-sm text-gray-600 mb-4">
                    <label className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium">
                      Click to upload photos
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/jpg"
                        onChange={handlePhotoChange}
                        className="hidden"
                      />
                    </label>
                    <span className="text-gray-500"> or drag and drop</span>
                  </div>
                  <p className="text-xs text-gray-500">JPG or PNG up to 10MB each</p>
                </div>

                {Object.keys(errors).some(key => key.startsWith('file_')) && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <div className="text-sm text-red-700">
                      {Object.entries(errors)
                        .filter(([key]) => key.startsWith('file_'))
                        .map(([_, message]) => (
                          <p key={message}>• {message}</p>
                        ))}
                    </div>
                  </div>
                )}

                {errors.total && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <p className="text-sm text-red-700">{errors.total}</p>
                  </div>
                )}

                {photoPreview.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-3">
                      Selected Photos ({photoPreview.length}/10):
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {photoPreview.map((preview) => (
                        <div key={preview.id} className="relative group">
                          <img
                            src={preview.url}
                            alt={preview.file.name}
                            className="w-full h-24 object-cover rounded-lg border border-gray-200"
                          />
                          {uploadProgress[preview.id] !== undefined && (
                            <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                              <div className="text-white text-sm">
                                {uploadProgress[preview.id]}%
                              </div>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => removePhoto(preview.id)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600 focus:outline-none"
                          >
                            ×
                          </button>
                          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 rounded-b-lg truncate">
                            {preview.file.name}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={submitting || !feedback.status}
                className="w-full bg-blue-600 text-white py-4 px-6 rounded-lg font-semibold text-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Submitting Feedback...
                  </>
                ) : (
                  'Submit Feedback'
                )}
              </button>
              {!feedback.status && (
                <p className="text-sm text-gray-500 text-center mt-2">
                  Please select your feedback option to continue
                </p>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}