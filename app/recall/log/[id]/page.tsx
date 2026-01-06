'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getLog, updateLog, deleteLog, deletePhoto } from '@/lib/recall/supabase'
import { getSignedUrls, deletePhoto as deletePhotoFromStorage } from '@/lib/recall/storage'
import { exportLogPhotosToZip, downloadSinglePhoto } from '@/lib/recall/export'
import { RecallLogWithPhotos, LogType } from '@/lib/recall/types'

interface LogDetailPageProps {
  params: Promise<{ id: string }>
}

const LOG_TYPES: LogType[] = ['Before', 'During', 'After', 'Issue', 'Resolution', 'Call', 'Visit', 'Invoice']

export default function LogDetailPage({ params }: LogDetailPageProps) {
  const router = useRouter()
  const resolvedParams = use(params)
  const [log, setLog] = useState<RecallLogWithPhotos | null>(null)
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ log_type: 'Invoice' as LogType, note: '' })
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  useEffect(() => {
    loadLog()
  }, [resolvedParams.id])

  useEffect(() => {
    if (log?.photos && log.photos.length > 0) {
      loadPhotoUrls()
    }
  }, [log?.photos])

  const loadLog = async () => {
    try {
      setError('')
      const data = await getLog(resolvedParams.id)
      if (!data) {
        setError('Log not found')
        return
      }
      setLog(data)
      setEditForm({ log_type: data.log_type, note: data.note })
    } catch (err) {
      console.error('Error loading log:', err)
      setError('Failed to load log')
    } finally {
      setLoading(false)
    }
  }

  const loadPhotoUrls = async () => {
    if (!log?.photos) return
    
    try {
      const paths = log.photos.map(p => p.storage_path)
      const urls = await getSignedUrls(paths)
      setPhotoUrls(urls)
    } catch (err) {
      console.error('Error loading photo URLs:', err)
    }
  }

  const handleSaveEdit = async () => {
    if (!log) return

    try {
      const updated = await updateLog(log.id, editForm)
      setLog({ ...log, ...updated })
      setEditing(false)
    } catch (err) {
      console.error('Error updating log:', err)
      setError('Failed to update log')
    }
  }

  const handleDeletePhoto = async (photoId: string, storagePath: string) => {
    try {
      // Delete from storage
      await deletePhotoFromStorage(storagePath)
      
      // Delete from database
      await deletePhoto(photoId)
      
      // Update local state
      if (log) {
        setLog({
          ...log,
          photos: log.photos?.filter(p => p.id !== photoId)
        })
      }
      
      // Remove from URLs
      setPhotoUrls(prev => {
        const newUrls = { ...prev }
        delete newUrls[storagePath]
        return newUrls
      })
    } catch (err) {
      console.error('Error deleting photo:', err)
      setError('Failed to delete photo')
    }
  }

  const handleDownloadSingle = async (photo: any) => {
    try {
      await downloadSinglePhoto(photo)
    } catch (err) {
      console.error('Error downloading photo:', err)
      setError('Failed to download photo')
    }
  }

  const handleDownloadAllPhotos = async () => {
    if (!log) return

    try {
      await exportLogPhotosToZip(log, (log as any).case?.title)
    } catch (err) {
      console.error('Error downloading photos:', err)
      setError('Failed to download photos')
    }
  }

  const handleDeleteAllPhotos = async () => {
    if (!log?.photos) return

    try {
      for (const photo of log.photos) {
        await deletePhotoFromStorage(photo.storage_path)
        await deletePhoto(photo.id)
      }
      
      setLog({ ...log, photos: [] })
      setPhotoUrls({})
    } catch (err) {
      console.error('Error deleting photos:', err)
      setError('Failed to delete photos')
    }
  }

  const handleDeleteLog = async () => {
    if (deleteConfirm !== 'DELETE' || !log) return

    try {
      await deleteLog(log.id)
      router.back()
    } catch (err) {
      console.error('Error deleting log:', err)
      setError('Failed to delete log')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const getLogTypeColor = (type: LogType) => {
    const colors = {
      'Before': 'bg-blue-100 text-blue-800 border-blue-200',
      'During': 'bg-yellow-100 text-yellow-800 border-yellow-200', 
      'After': 'bg-green-100 text-green-800 border-green-200',
      'Issue': 'bg-red-100 text-red-800 border-red-200',
      'Resolution': 'bg-purple-100 text-purple-800 border-purple-200',
      'Call': 'bg-indigo-100 text-indigo-800 border-indigo-200',
      'Visit': 'bg-orange-100 text-orange-800 border-orange-200',
      'Invoice': 'bg-teal-100 text-teal-800 border-teal-200'
    }
    return colors[type] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading log...</p>
        </div>
      </div>
    )
  }

  if (!log) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Log not found</h1>
          <button onClick={() => router.back()} className="text-blue-600 hover:text-blue-800">
            ← Go Back
          </button>
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
              <button 
                onClick={() => router.back()}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Log Details</h1>
                {(log as any).case && (
                  <p className="text-sm text-gray-500">{(log as any).case.title}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => setEditing(!editing)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              {editing ? 'Cancel' : 'Edit'}
            </button>
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

      <div className="max-w-md mx-auto px-4 py-4">
        {/* Log Info */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Log Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {LOG_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setEditForm(prev => ({ ...prev, log_type: type }))}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        editForm.log_type === type
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={editForm.note}
                  onChange={(e) => setEditForm(prev => ({ ...prev, note: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  maxLength={1000}
                />
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg text-sm"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${getLogTypeColor(log.log_type)}`}>
                  {log.log_type}
                </span>
              </div>
              
              <div>
                <p className="text-sm text-gray-500 mb-1">Created</p>
                <p className="text-gray-900">{formatDate(log.created_at)}</p>
              </div>
              
              {log.updated_at !== log.created_at && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Last Updated</p>
                  <p className="text-gray-900">{formatDate(log.updated_at)}</p>
                </div>
              )}
              
              {log.note.trim() && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Notes</p>
                  <p className="text-gray-900 whitespace-pre-wrap">{log.note}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Photos Section */}
        {log.photos && log.photos.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900">
                Photos ({log.photos.length})
              </h2>
              <div className="flex space-x-2">
                <button
                  onClick={handleDownloadAllPhotos}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  📦 ZIP
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mb-3">
              {log.photos.map((photo) => (
                <div key={photo.id} className="relative group">
                  {photoUrls[photo.storage_path] ? (
                    <img
                      src={photoUrls[photo.storage_path]}
                      alt={photo.original_filename || 'Photo'}
                      className="w-full h-24 object-cover rounded-lg border border-gray-200 cursor-pointer"
                      onClick={() => setSelectedPhoto(photoUrls[photo.storage_path])}
                    />
                  ) : (
                    <div className="w-full h-24 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    </div>
                  )}
                  
                  {/* Photo Actions */}
                  <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center space-x-1">
                    <button
                      onClick={() => handleDownloadSingle(photo)}
                      className="bg-white bg-opacity-90 hover:bg-opacity-100 text-gray-700 p-1 rounded text-xs"
                      title="Download"
                    >
                      ⬇️
                    </button>
                    <button
                      onClick={() => handleDeletePhoto(photo.id, photo.storage_path)}
                      className="bg-red-600 bg-opacity-90 hover:bg-opacity-100 text-white p-1 rounded text-xs"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            {log.photos.length > 1 && (
              <button
                onClick={handleDeleteAllPhotos}
                className="w-full bg-red-50 hover:bg-red-100 text-red-700 font-medium py-2 px-4 rounded-lg text-sm border border-red-200 transition-colors"
              >
                Delete All Photos
              </button>
            )}
          </div>
        )}

        {/* Danger Zone */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="font-medium text-red-900 mb-2">Delete Log</h3>
          <p className="text-red-700 text-sm mb-3">
            Permanently delete this log and all its photos.
          </p>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
          >
            Delete Log
          </button>
        </div>
      </div>

      {/* Photo Modal */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedPhoto(null)}
        >
          <img
            src={selectedPhoto}
            alt="Full size"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Log</h3>
            <p className="text-gray-600 text-sm mb-4">
              This will permanently delete this log and all its photos. This action cannot be undone.
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
                onClick={handleDeleteLog}
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