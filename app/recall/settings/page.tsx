'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { checkStorageBucket } from '@/lib/recall/storage'

export default function RecallSettingsPage() {
  const [bucketStatus, setBucketStatus] = useState<'checking' | 'available' | 'unavailable'>('checking')

  useEffect(() => {
    checkBucket()
  }, [])

  const checkBucket = async () => {
    try {
      const isAvailable = await checkStorageBucket()
      setBucketStatus(isAvailable ? 'available' : 'unavailable')
    } catch {
      setBucketStatus('unavailable')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link 
                href="/recall"
                className="p-1 hover:bg-gray-100 rounded"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Storage Status */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold text-gray-900 mb-3">Storage Status</h2>
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-700">Recall Bucket</span>
            <div className="flex items-center">
              {bucketStatus === 'checking' && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              )}
              {bucketStatus === 'available' && (
                <div className="flex items-center text-green-600">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm">Available</span>
                </div>
              )}
              {bucketStatus === 'unavailable' && (
                <div className="flex items-center text-red-600">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm">Not Available</span>
                </div>
              )}
            </div>
          </div>
          {bucketStatus === 'unavailable' && (
            <div className="bg-red-50 border border-red-200 rounded p-3 mt-2">
              <p className="text-red-800 text-sm">
                Storage bucket not found. Please create the &quot;recall&quot; bucket in your Supabase dashboard.
              </p>
            </div>
          )}
        </div>

        {/* Data Ownership */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold text-gray-900 mb-3">📁 Your Data</h2>
          <div className="space-y-3 text-sm text-gray-700">
            <p>
              All your cases, logs, and photos are stored securely in your Supabase project. 
              You own and control this data completely.
            </p>
            <p>
              <strong>Storage Location:</strong> Supabase Storage (recall bucket)
            </p>
            <p>
              <strong>Database:</strong> PostgreSQL with Row Level Security
            </p>
          </div>
        </div>

        {/* Download Instructions */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold text-gray-900 mb-3">💾 Backup & Download</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-800 mb-2">From Recall App</h3>
              <ul className="space-y-1 text-sm text-gray-700">
                <li>• Download individual photos from log details</li>
                <li>• Export case photos as ZIP files</li>
                <li>• Generate PDF reports with case summaries</li>
                <li>• Delete cloud photos after local download</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-800 mb-2">From Supabase Dashboard</h3>
              <ol className="space-y-1 text-sm text-gray-700 list-decimal list-inside">
                <li>Go to your Supabase project dashboard</li>
                <li>Navigate to Storage → recall bucket</li>
                <li>Browse recall_cases folder structure</li>
                <li>Download individual files or entire folders</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Mobile PWA */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold text-gray-900 mb-3">📱 Mobile App</h2>
          <div className="space-y-3 text-sm text-gray-700">
            <p>
              Add Recall to your home screen for the best mobile experience:
            </p>
            
            <div>
              <h4 className="font-medium text-gray-800">iOS (Safari):</h4>
              <ol className="list-decimal list-inside space-y-1 mt-1">
                <li>Tap the share button</li>
                <li>Select &quot;Add to Home Screen&quot;</li>
                <li>Tap &quot;Add&quot;</li>
              </ol>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-800">Android (Chrome):</h4>
              <ol className="list-decimal list-inside space-y-1 mt-1">
                <li>Tap the menu (⋮)</li>
                <li>Select &quot;Add to Home screen&quot;</li>
                <li>Tap &quot;Add&quot;</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Best Practices */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h2 className="font-semibold text-blue-900 mb-3">💡 Best Practices</h2>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>• <strong>Regular Downloads:</strong> Export important cases as PDF + ZIP</li>
            <li>• <strong>Storage Management:</strong> Delete cloud photos after local backup</li>
            <li>• <strong>Organization:</strong> Use clear case titles and log types</li>
            <li>• <strong>Photo Quality:</strong> Take clear, well-lit photos</li>
            <li>• <strong>Notes:</strong> Add detailed descriptions for future reference</li>
            <li>• <strong>Backup:</strong> Keep local copies of critical project data</li>
          </ul>
        </div>

        {/* Version Info */}
        <div className="bg-gray-100 border border-gray-200 rounded-lg p-4 text-center">
          <p className="text-gray-600 text-sm">
            <strong>Recall v0.1</strong>
          </p>
          <p className="text-gray-500 text-xs mt-1">
            Built with Next.js + Supabase
          </p>
        </div>
      </div>
    </div>
  )
}