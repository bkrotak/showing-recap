'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface FormData {
  buyer_name: string
  buyer_phone: string
  buyer_email: string
  address: string
  city: string
  state: string
  zip: string
  showing_datetime: string
}

interface FormErrors {
  [key: string]: string
}

export default function NewShowingPage() {
  const [loading, setLoading] = useState(false)
  const [showingData, setShowingData] = useState<FormData>({
    buyer_name: '',
    buyer_phone: '',
    buyer_email: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    showing_datetime: ''
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [publicUrl, setPublicUrl] = useState('')
  const [copySuccess, setCopySuccess] = useState(false)
  const [sendSms, setSendSms] = useState(false)
  const [smsLoading, setSmsLoading] = useState(false)
  const [smsMessage, setSmsMessage] = useState('')
  const [smsResult, setSmsResult] = useState<{ success?: boolean; error?: string } | null>(null)
  const router = useRouter()

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    // Required field validation
    if (!showingData.buyer_name.trim()) newErrors.buyer_name = 'Buyer name is required'
    if (!showingData.buyer_phone.trim()) newErrors.buyer_phone = 'Buyer phone is required'
    if (!showingData.address.trim()) newErrors.address = 'Property address is required'
    if (!showingData.city.trim()) newErrors.city = 'City is required'
    if (!showingData.state.trim()) newErrors.state = 'State is required'
    if (!showingData.zip.trim()) newErrors.zip = 'ZIP code is required'
    if (!showingData.showing_datetime) newErrors.showing_datetime = 'Showing date/time is required'

    // Phone format validation (E.164)
    if (showingData.buyer_phone && !showingData.buyer_phone.startsWith('+')) {
      newErrors.buyer_phone = 'Phone must start with + (E.164 format)'
    }

    // Email validation (if provided)
    if (showingData.buyer_email && !/\S+@\S+\.\S+/.test(showingData.buyer_email)) {
      newErrors.buyer_email = 'Please enter a valid email address'
    }

    // State validation (2 characters)
    if (showingData.state && showingData.state.length !== 2) {
      newErrors.state = 'State must be 2 characters (e.g., CA, NY)'
    }

    // ZIP validation (basic)
    if (showingData.zip && !/^\d{5}(-\d{4})?$/.test(showingData.zip)) {
      newErrors.zip = 'ZIP code must be 5 digits (12345) or 9 digits (12345-6789)'
    }

    // Date validation (must be in future)
    if (showingData.showing_datetime) {
      const showingDate = new Date(showingData.showing_datetime)
      const now = new Date()
      if (showingDate <= now) {
        newErrors.showing_datetime = 'Showing must be scheduled for a future date/time'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/showings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(showingData)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create showing')
      }

      setPublicUrl(result.publicUrl)

      // Send SMS if requested
      if (sendSms) {
        await sendSmsNotification(result.showing.id)
      }
    } catch (error) {
      console.error('Error creating showing:', error)
      alert(error instanceof Error ? error.message : 'Error creating showing')
    }

    setLoading(false)
  }

  const sendSmsNotification = async (showingId: string) => {
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
          showingId,
          message: smsMessage || undefined
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send SMS')
      }

      setSmsResult({ success: true })
    } catch (error) {
      console.error('SMS error:', error)
      setSmsResult({ 
        error: error instanceof Error ? error.message : 'Failed to send SMS' 
      })
    }

    setSmsLoading(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setShowingData({
      ...showingData,
      [name]: value
    })
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: ''
      })
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      // Fallback for browsers that don't support clipboard API
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

  if (publicUrl) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-green-600 mb-4">Showing Created!</h2>
            <p className="text-gray-600 mb-2">
              <strong>Property:</strong> {showingData.address}
            </p>
            <p className="text-gray-600 mb-6">
              <strong>Buyer:</strong> {showingData.buyer_name}
            </p>

            {/* SMS Status */}
            {sendSms && (
              <div className="mb-4">
                {smsLoading ? (
                  <div className="flex items-center justify-center text-blue-600">
                    <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Sending SMS...
                  </div>
                ) : smsResult?.success ? (
                  <div className="text-green-600 text-sm bg-green-50 p-2 rounded">
                    ✓ SMS sent to {showingData.buyer_name}
                  </div>
                ) : smsResult?.error ? (
                  <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
                    SMS Error: {smsResult.error}
                  </div>
                ) : null}
              </div>
            )}

            <p className="text-gray-600 mb-4 text-sm">
              Share this link with the buyer to collect their feedback:
            </p>
            <div className="bg-gray-50 p-3 rounded border text-xs break-all mb-4 font-mono">
              {publicUrl}
            </div>
            <div className="space-y-3">
              <button
                onClick={copyToClipboard}
                className={`w-full py-2 px-4 rounded font-medium transition-colors ${
                  copySuccess 
                    ? 'bg-green-600 text-white' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {copySuccess ? '✓ Copied!' : 'Copy Link'}
              </button>
              <Link
                href="/dashboard"
                className="block w-full bg-gray-600 text-white py-2 px-4 rounded hover:bg-gray-700 text-center font-medium"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-blue-600 hover:text-blue-800">
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Showing</h1>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Buyer Name *
                  </label>
                  <input
                    type="text"
                    name="buyer_name"
                    required
                    value={showingData.buyer_name}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.buyer_name ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="John Doe"
                  />
                  {errors.buyer_name && (
                    <p className="mt-1 text-sm text-red-600">{errors.buyer_name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Buyer Phone (E.164 format, e.g. +1234567890) *
                  </label>
                  <input
                    type="tel"
                    name="buyer_phone"
                    required
                    value={showingData.buyer_phone}
                    onChange={handleInputChange}
                    placeholder="+1234567890"
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.buyer_phone ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {errors.buyer_phone && (
                    <p className="mt-1 text-sm text-red-600">{errors.buyer_phone}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Buyer Email (Optional)
                  </label>
                  <input
                    type="email"
                    name="buyer_email"
                    value={showingData.buyer_email}
                    onChange={handleInputChange}
                    placeholder="buyer@example.com"
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.buyer_email ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {errors.buyer_email && (
                    <p className="mt-1 text-sm text-red-600">{errors.buyer_email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Property Address *
                  </label>
                  <input
                    type="text"
                    name="address"
                    required
                    value={showingData.address}
                    onChange={handleInputChange}
                    placeholder="123 Main St"
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.address ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {errors.address && (
                    <p className="mt-1 text-sm text-red-600">{errors.address}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City *
                    </label>
                    <input
                      type="text"
                      name="city"
                      required
                      value={showingData.city}
                      onChange={handleInputChange}
                      placeholder="San Francisco"
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.city ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                    {errors.city && (
                      <p className="mt-1 text-sm text-red-600">{errors.city}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      State *
                    </label>
                    <input
                      type="text"
                      name="state"
                      required
                      value={showingData.state}
                      onChange={handleInputChange}
                      placeholder="CA"
                      maxLength={2}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.state ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                    {errors.state && (
                      <p className="mt-1 text-sm text-red-600">{errors.state}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ZIP Code *
                  </label>
                  <input
                    type="text"
                    name="zip"
                    required
                    value={showingData.zip}
                    onChange={handleInputChange}
                    placeholder="90210"
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.zip ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {errors.zip && (
                    <p className="mt-1 text-sm text-red-600">{errors.zip}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Showing Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    name="showing_datetime"
                    required
                    value={showingData.showing_datetime}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.showing_datetime ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {errors.showing_datetime && (
                    <p className="mt-1 text-sm text-red-600">{errors.showing_datetime}</p>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="send_sms"
                      type="checkbox"
                      checked={sendSms}
                      onChange={(e) => setSendSms(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3">
                    <label htmlFor="send_sms" className="text-sm font-medium text-gray-700">
                      Send SMS to buyer
                    </label>
                    <p className="text-sm text-gray-500">
                      Automatically text the feedback link to {showingData.buyer_phone || 'the buyer'}
                    </p>
                  </div>
                </div>

                {sendSms && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Custom SMS Message (Optional)
                    </label>
                    <textarea
                      value={smsMessage}
                      onChange={(e) => setSmsMessage(e.target.value)}
                      placeholder={`Hi ${showingData.buyer_name || '[Buyer Name]'}! Here's the link to provide feedback on your showing at ${showingData.address || '[Property Address]'}: [Link will be added automatically]`}
                      maxLength={300}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Leave blank for default message. Link will be added automatically. ({smsMessage.length}/300)
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Showing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}