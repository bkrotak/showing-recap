'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getCase, deleteCase } from '@/lib/recall/supabase'
import { exportCaseToPDF, exportCasePhotosToZip } from '@/lib/recall/export'
import { RecallCaseWithLogs, LogType } from '@/lib/recall/types'

interface CaseDetailPageProps {
  params: { id: string }
}

export default function CaseDetailPage({ params }: CaseDetailPageProps) {
  const router = useRouter()
  const [case_, setCase] = useState<RecallCaseWithLogs | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)

  useEffect(() => {
    loadCase()
  }, [params.id])

  const loadCase = async () => {
    try {
      setError('')
      const data = await getCase(params.id)
      if (!data) {
        setError('Case not found')
        return
      }
      setCase(data)
    } catch (err) {
      console.error('Error loading case:', err)
      setError('Failed to load case')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (deleteConfirm !== 'DELETE' || !case_) return

    try {
      await deleteCase(case_.id)
      router.push('/recall')
    } catch (err) {
      console.error('Error deleting case:', err)
      setError('Failed to delete case')
    }
  }

  const handleExportPDF = async () => {
    if (!case_) return
    
    setExportLoading(true)
    try {
      await exportCaseToPDF(case_, case_.logs || [])
    } catch (err) {
      console.error('Error exporting PDF:', err)
      setError('Failed to export PDF')
    } finally {
      setExportLoading(false)
    }
  }

  const handleExportPhotos = async () => {
    if (!case_) return
    
    setExportLoading(true)
    try {
      await exportCasePhotosToZip(case_, case_.logs || [])
    } catch (err) {
      console.error('Error exporting photos:', err)
      setError('Failed to export photos')
    } finally {
      setExportLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const getLogTypeColor = (type: LogType) => {
    const colors = {
      'Before': 'bg-blue-100 text-blue-800',
      'During': 'bg-yellow-100 text-yellow-800', 
      'After': 'bg-green-100 text-green-800',
      'Issue': 'bg-red-100 text-red-800',
      'Resolution': 'bg-purple-100 text-purple-800',
      'Call': 'bg-indigo-100 text-indigo-800',
      'Visit': 'bg-orange-100 text-orange-800',
      'General': 'bg-gray-100 text-gray-800'
    }
    return colors[type] || colors.General
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading case...</p>
        </div>
      </div>
    )
  }

  if (!case_) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Case not found</h1>
          <Link href="/recall" className="text-blue-600 hover:text-blue-800">
            ← Back to Cases
          </Link>
        </div>
      </div>
    )
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
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-semibold text-gray-900 truncate">{case_.title}</h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="max-w-md mx-auto px-4 pt-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Case Details */}
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <div className="space-y-2">
            {case_.client_name && (
              <p className="text-gray-600">
                <span className="font-medium">Client:</span> {case_.client_name}
              </p>
            )}
            {case_.location_text && (
              <p className="text-gray-600">
                <span className="font-medium">Location:</span> {case_.location_text}
              </p>
            )}
            <p className="text-gray-500 text-sm">
              Created {formatDate(case_.created_at)}
            </p>
            {case_.updated_at !== case_.created_at && (
              <p className="text-gray-500 text-sm">
                Updated {formatDate(case_.updated_at)}
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 gap-3 mb-6">
          <Link
            href={`/recall/case/${case_.id}/log/new`}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg text-center transition-colors"
          >
            + Add Log
          </Link>
          
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleExportPDF}
              disabled={exportLoading}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-3 rounded-lg text-sm transition-colors"
            >
              📄 Export PDF
            </button>
            
            <button
              onClick={handleExportPhotos}
              disabled={exportLoading || !case_.logs?.some(log => (log as any).photo_count > 0)}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-medium py-2 px-3 rounded-lg text-sm transition-colors"
            >
              📦 Photos ZIP
            </button>
          </div>
        </div>

        {/* Logs Section */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Logs ({case_.logs?.length || 0})
          </h2>
          
          {!case_.logs || case_.logs.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
              <div className="text-gray-400 mb-3">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="font-medium text-gray-900 mb-2">No logs yet</h3>
              <p className="text-gray-500 text-sm mb-4">
                Start documenting your work with photos and notes
              </p>
              <Link
                href={`/recall/case/${case_.id}/log/new`}
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
              >
                Add First Log
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {case_.logs
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map((log) => (
                  <Link
                    key={log.id}
                    href={`/recall/log/${log.id}`}
                    className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getLogTypeColor(log.log_type)}`}>
                        {log.log_type}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDate(log.created_at)}
                      </span>
                    </div>
                    
                    {log.note.trim() && (
                      <p className="text-gray-700 text-sm mb-2 line-clamp-2">
                        {log.note}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-xs text-gray-500">
                        {(log as any).photo_count > 0 && (
                          <span className="flex items-center">
                            📷 {(log as any).photo_count}
                          </span>
                        )}
                      </div>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                ))}
            </div>
          )}
        </div>

        {/* Danger Zone */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="font-medium text-red-900 mb-2">Danger Zone</h3>
          <p className="text-red-700 text-sm mb-3">
            Permanently delete this case and all its logs and photos.
          </p>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
          >
            Delete Case
          </button>
        </div>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Case</h3>
            <p className="text-gray-600 text-sm mb-4">
              This will permanently delete &quot;{case_.title}&quot; and all its logs and photos. This action cannot be undone.
            </p>
            <p className="text-sm text-gray-600 mb-3">
              Type <span className="font-mono bg-gray-100 px-1 rounded">DELETE</span> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Type DELETE"
            />
            <div className="flex space-x-2">
              <button
                onClick={handleDelete}
                disabled={deleteConfirm !== 'DELETE'}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded text-sm transition-colors"
              >
                Delete Forever
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeleteConfirm('')
                }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}