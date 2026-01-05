'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import type { Showing, ShowingPhoto } from '@/lib/types'

export default function ShowingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const showingId = params.id as string
  
  const [showing, setShowing] = useState<Showing | null>(null)
  const [photos, setPhotos] = useState<ShowingPhoto[]>([])
  const [photoUrls, setPhotoUrls] = useState<{ [key: string]: string }>({})
  const [loading, setLoading] = useState(true)
  const [photoLoading, setPhotoLoading] = useState(true)
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)
  const [smsLoading, setSmsLoading] = useState(false)
  const [smsResult, setSmsResult] = useState<{ success?: boolean; error?: string } | null>(null)

  useEffect(() => {
    if (showingId) {
      loadShowing()
      loadPhotos()
    }
  }, [showingId])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return false
    }
    return true
  }

  const loadShowing = async () => {
    if (!(await checkUser())) return

    const { data, error } = await supabase
      .from('showings')
      .select('*')
      .eq('id', showingId)
      .single()

    if (error) {
      console.error('Error loading showing:', error)
      router.push('/dashboard')
    } else {
      setShowing(data)
    }
    setLoading(false)
  }

  const loadPhotos = async () => {
    const { data, error } = await supabase
      .from('showing_photos')
      .select('*')
      .eq('showing_id', showingId)
      .order('uploaded_at', { ascending: true })

    if (error) {
      console.error('Error loading photos:', error)
    } else {
      setPhotos(data || [])
      
      // Load photo URLs
      const urls: { [key: string]: string } = {}
      for (const photo of data || []) {
        const { data: urlData } = await supabase.storage
          .from('showing-photos')
          .createSignedUrl(photo.storage_path, 3600) // 1 hour expiry
        
        if (urlData?.signedUrl) {
          urls[photo.id] = urlData.signedUrl
        }
      }
      setPhotoUrls(urls)
    }
    setPhotoLoading(false)
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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const copyPublicLink = async () => {
    if (!showing) return
    
    const publicUrl = `${window.location.origin}/r/${showing.public_token}`
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      // Fallback
      const textArea = document.createElement('textarea')
      textArea.value = publicUrl
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    }
  }

  const sendSmsReminder = async () => {
    if (!showing) return

    setSmsLoading(true)
    setSmsResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          showingId: showing.id,
          message: `Hi ${showing.buyer_name}! Reminder: Please share your feedback on the showing at ${showing.address}. Link: ${window.location.origin}/r/${showing.public_token}`
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send SMS')
      }

      setSmsResult({ success: true })
      setTimeout(() => setSmsResult(null), 5000) // Clear success message after 5 seconds
    } catch (error) {
      console.error('SMS error:', error)
      setSmsResult({ 
        error: error instanceof Error ? error.message : 'Failed to send SMS' 
      })
    }

    setSmsLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">Loading showing details...</div>
        </div>
      </div>
    )
  }

  if (!showing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Showing Not Found</h1>
          <Link 
            href="/dashboard"
            className="text-blue-600 hover:text-blue-800"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const publicUrl = `${window.location.origin}/r/${showing.public_token}`

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-blue-600 hover:text-blue-800 font-medium">
                ← Back to Dashboard
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={copyPublicLink}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  copySuccess 
                    ? 'bg-green-600 text-white' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {copySuccess ? '✓ Copied!' : 'Copy Buyer Link'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Property & Buyer Info */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white shadow rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <div className="flex-shrink-0">
                    <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <h1 className="text-2xl font-bold text-gray-900">{showing.address}</h1>
                    <p className="text-gray-600">{showing.city}, {showing.state} {showing.zip}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Buyer Name</p>
                    <p className="font-medium text-gray-900">{showing.buyer_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Phone</p>
                    <p className="font-medium text-gray-900">
                      <a href={`tel:${showing.buyer_phone}`} className="text-blue-600 hover:text-blue-800">
                        {showing.buyer_phone}
                      </a>
                    </p>
                  </div>
                  {showing.buyer_email && (
                    <div>
                      <p className="text-gray-500">Email</p>
                      <p className="font-medium text-gray-900">
                        <a href={`mailto:${showing.buyer_email}`} className="text-blue-600 hover:text-blue-800">
                          {showing.buyer_email}
                        </a>
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-gray-500">Showing Date</p>
                    <p className="font-medium text-gray-900">{formatDateTime(showing.showing_datetime)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Created</p>
                    <p className="font-medium text-gray-900">{formatDateTime(showing.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Public Link</p>
                    <div className="flex items-center space-x-2">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono break-all">
                        {publicUrl}
                      </code>
                    </div>
                  </div>
                </div>
              </div>

              {/* Photos Section */}
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Photos ({photos.length})
                </h2>
                {photoLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-500">Loading photos...</p>
                  </div>
                ) : photos.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p>No photos uploaded yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {photos.map((photo) => (
                      <div key={photo.id} className="relative group">
                        {photoUrls[photo.id] ? (
                          <img
                            src={photoUrls[photo.id]}
                            alt={photo.original_name}
                            className="w-full h-24 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setSelectedPhoto(photoUrls[photo.id])}
                          />
                        ) : (
                          <div className="w-full h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                            <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 rounded-b-lg">
                          <p className="truncate">{photo.original_name}</p>
                          {photo.file_size && (
                            <p className="text-gray-300">{formatFileSize(photo.file_size)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Feedback Panel */}
            <div className="space-y-6">
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Buyer Feedback</h2>
                
                {showing.feedback_submitted_at ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-500 mb-2">Status</p>
                      <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                        showing.feedback_status === 'INTERESTED' ? 'bg-green-100 text-green-800 border border-green-200' :
                        showing.feedback_status === 'NOT_FOR_US' ? 'bg-red-100 text-red-800 border border-red-200' :
                        'bg-yellow-100 text-yellow-800 border border-yellow-200'
                      }`}>
                        {showing.feedback_status === 'INTERESTED' ? '👍 Interested' :
                         showing.feedback_status === 'NOT_FOR_US' ? '👎 Not for us' :
                         '🤔 Maybe'}
                      </span>
                    </div>
                    
                    {showing.feedback_note && (
                      <div>
                        <p className="text-sm text-gray-500 mb-2">Comments</p>
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-gray-700 text-sm leading-relaxed">
                            "{showing.feedback_note}"
                          </p>
                        </div>
                      </div>
                    )}
                    
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Submitted</p>
                      <p className="text-sm text-gray-700">{formatDateTime(showing.feedback_submitted_at)}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <p className="text-gray-500 mb-4">No feedback yet</p>
                    <p className="text-sm text-gray-400">
                      Share the buyer link to collect feedback
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-blue-800 mb-2">Quick Actions</h3>
                
                {/* SMS Status Display */}
                {smsResult && (
                  <div className={`mb-3 p-2 rounded text-sm ${
                    smsResult.success 
                      ? 'bg-green-50 text-green-700 border border-green-200' 
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {smsResult.success ? '✓ SMS reminder sent!' : `Error: ${smsResult.error}`}
                  </div>
                )}

                <div className="space-y-2">
                  <button
                    onClick={copyPublicLink}
                    className="w-full text-left text-sm text-blue-700 hover:text-blue-900 py-2 px-3 rounded bg-white hover:bg-blue-50 transition-colors"
                  >
                    📋 Copy Buyer Link
                  </button>
                  <button
                    onClick={sendSmsReminder}
                    disabled={smsLoading}
                    className="w-full text-left text-sm text-blue-700 hover:text-blue-900 py-2 px-3 rounded bg-white hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {smsLoading ? (
                      <span className="flex items-center">
                        <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Sending SMS...
                      </span>
                    ) : (
                      '📱 Send SMS Reminder'
                    )}
                  </button>
                  <a
                    href={`tel:${showing.buyer_phone}`}
                    className="block w-full text-left text-sm text-blue-700 hover:text-blue-900 py-2 px-3 rounded bg-white hover:bg-blue-50 transition-colors"
                  >
                    📞 Call Buyer
                  </a>
                  {showing.buyer_email && (
                    <a
                      href={`mailto:${showing.buyer_email}?subject=Property Showing Follow-up&body=Hi ${showing.buyer_name},%0D%0A%0D%0AThank you for viewing ${showing.address}. I wanted to follow up and see if you have any questions.%0D%0A%0D%0ABest regards`}
                      className="block w-full text-left text-sm text-blue-700 hover:text-blue-900 py-2 px-3 rounded bg-white hover:bg-blue-50 transition-colors"
                    >
                      ✉️ Email Buyer
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Photo Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-4xl max-h-full">
            <img
              src={selectedPhoto}
              alt="Full size photo"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 bg-black bg-opacity-50 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-75 focus:outline-none"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}