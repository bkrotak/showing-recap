'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getCase, deleteCase, getAllCasePhotos } from '@/lib/recall/supabase'
import { exportCaseToPDF, exportPhotosToZip } from '@/lib/recall/export'
import { getSignedUrls } from '@/lib/recall/storage'
import { supabase } from '@/lib/supabase'
import { RecallCaseWithLogs, LogType, RecallPhoto } from '@/lib/recall/types'

interface CaseDetailPageProps {
  params: Promise<{ id: string }>
}

export default function CaseDetailPage({ params }: CaseDetailPageProps) {
  const router = useRouter()
  const resolvedParams = use(params)
  const [case_, setCase] = useState<RecallCaseWithLogs | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [showPhotoSelector, setShowPhotoSelector] = useState(false)
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([])
  const [allCasePhotos, setAllCasePhotos] = useState<RecallPhoto[]>([])
  const [selectorPhotoUrls, setSelectorPhotoUrls] = useState<Record<string, string>>({})
  const [loadingPhotos, setLoadingPhotos] = useState(false)

  useEffect(() => {
    loadCase()
  }, [resolvedParams.id])

  const loadCase = async () => {
    try {
      setError('')
      const data = await getCase(resolvedParams.id)
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
    try {
      await deleteCase(case_.id)
      router.push('/recall')
    } catch (err) {
      console.error('Error deleting case:', err)
      console.error('Full error object:', JSON.stringify(err, null, 2))
      setError(`Failed to delete case: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setShowDeleteModal(false)
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

  const handleExportSelectedPhotos = async () => {
    if (!case_ || selectedPhotoIds.length === 0 || allCasePhotos.length === 0) return
    
    console.log('Export Debug - Selected photo IDs:', selectedPhotoIds)
    console.log('Export Debug - All case photos:', allCasePhotos.length)
    console.log('Export Debug - Photos data:', allCasePhotos.map(p => ({ 
      id: p.id, 
      storage_path: p.storage_path, 
      filename: p.original_filename 
    })))
    
    setExportLoading(true)
    try {
      await exportPhotosToZip(case_, allCasePhotos, selectedPhotoIds)
      setShowPhotoSelector(false)
      setSelectedPhotoIds([])
    } catch (err) {
      console.error('Error exporting selected photos:', err)
      setError('Failed to export selected photos')
    } finally {
      setExportLoading(false)
    }
  }

  const togglePhotoSelection = (photoId: string) => {
    console.log('Photo Selection Debug - Toggling photo ID:', photoId)
    console.log('Photo Selection Debug - Current selected IDs:', selectedPhotoIds)
    
    setSelectedPhotoIds(prev => {
      const newSelection = prev.includes(photoId) 
        ? prev.filter(id => id !== photoId)
        : [...prev, photoId]
      console.log('Photo Selection Debug - New selection:', newSelection)
      return newSelection
    })
  }

  const selectAllPhotos = () => {
    const allPhotoIds = allCasePhotos.map(photo => photo.id)
    setSelectedPhotoIds(allPhotoIds)
  }

  const deselectAllPhotos = () => {
    setSelectedPhotoIds([])
  }

  const loadSelectorPhotoUrls = async () => {
    try {
      // Get all photos for this case
      const allPhotos = await getAllCasePhotos(resolvedParams.id)
      setAllCasePhotos(allPhotos)
      
      console.log('Photo Loading Debug - All photos from DB:', allPhotos.length)
      console.log('Photo Loading Debug - Photos:', allPhotos.map(p => ({ 
        id: p.id, 
        path: p.storage_path, 
        filename: p.original_filename 
      })))
      
      if (allPhotos.length === 0) {
        console.log('Photo Loading Debug - No photos found for case')
        return
      }

      setLoadingPhotos(true)
      
      // First check if recall bucket exists
      const { data: buckets, error: bucketError } = await supabase.storage.listBuckets()
      console.log('Photo Loading Debug - Available buckets:', buckets?.map(b => b.name))
      
      if (bucketError) {
        console.error('Photo Loading Debug - Bucket list error:', bucketError)
      }
      
      const paths = allPhotos.map(photo => photo.storage_path)
      console.log('Photo Loading Debug - Requesting signed URLs for paths:', paths)
      
      const urls = await getSignedUrls(paths)
      console.log('Photo Loading Debug - Received URLs:', urls)
      
      const photoUrlMap: Record<string, string> = {}
      allPhotos.forEach((photo, index) => {
        if (urls[index]) {
          photoUrlMap[photo.id] = urls[index]
        }
      })
      
      console.log('Photo Loading Debug - Photo URL map:', photoUrlMap)
      setSelectorPhotoUrls(photoUrlMap)
    } catch (error) {
      console.error('Failed to load photo URLs for selector:', error)
    } finally {
      setLoadingPhotos(false)
    }
  }

  const openPhotoSelector = async () => {
    setShowPhotoSelector(true)
    await loadSelectorPhotoUrls()
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
      'Invoice': 'bg-teal-100 text-teal-800'
    }
    return colors[type] || 'bg-gray-100 text-gray-800'
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
              onClick={openPhotoSelector}
              disabled={exportLoading || !case_.logs?.some(log => (log as any).photo_count > 0)}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-medium py-2 px-3 rounded-lg text-sm transition-colors"
            >
              📦 Select Photos
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

      {/* Photo Selection Modal */}
      {showPhotoSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold">Select Photos to Export</h3>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={selectAllPhotos}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAllPhotos}
                  className="text-sm text-gray-600 hover:text-gray-700"
                >
                  Deselect All
                </button>
                <span className="text-sm text-gray-500">
                  ({selectedPhotoIds.length} selected)
                </span>
              </div>
            </div>
            
            <div className="max-h-96 overflow-y-auto p-4">
              {allCasePhotos.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {allCasePhotos.map((photo, index) => {
                    console.log(`Photo Display Debug - Photo ${index}:`, {
                      id: photo.id,
                      storage_path: photo.storage_path,
                      filename: photo.original_filename,
                      hasUrl: !!selectorPhotoUrls[photo.id],
                      url: selectorPhotoUrls[photo.id],
                      isSelected: selectedPhotoIds.includes(photo.id)
                    })
                    
                    return (
                      <div key={`photo-${photo.id}-${index}`} className="relative">
                        <input
                          type="checkbox"
                          checked={selectedPhotoIds.includes(photo.id)}
                          onChange={() => togglePhotoSelection(photo.id)}
                          className="absolute top-2 left-2 w-4 h-4 z-10"
                        />
                        <div className="aspect-square bg-gray-200 rounded border overflow-hidden">
                          {selectorPhotoUrls[photo.id] ? (
                            <img
                              src={selectorPhotoUrls[photo.id]}
                              alt={photo.original_filename || 'Photo'}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : loadingPhotos ? (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                              Loading...
                            </div>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                              📷 {photo.original_filename || 'Photo'}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No photos found for this case</p>
              )}
            </div>
            
            <div className="p-4 border-t flex gap-2">
              <button
                onClick={handleExportSelectedPhotos}
                disabled={selectedPhotoIds.length === 0 || exportLoading}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded transition-colors"
              >
                {exportLoading ? 'Exporting...' : `Export ${selectedPhotoIds.length} Photos`}
              </button>
              <button
                onClick={() => {
                  setShowPhotoSelector(false)
                  setSelectedPhotoIds([])
                }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Case</h3>
            <p className="text-gray-600 text-sm mb-6">
              Are you sure you want to delete "{case_.title}" and all of its photos and notes? The case will be moved to trash and can be recovered if needed.
            </p>
            <div className="flex space-x-2">
              <button
                onClick={handleDelete}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded text-sm transition-colors"
              >
                Yes, Delete Case
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
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