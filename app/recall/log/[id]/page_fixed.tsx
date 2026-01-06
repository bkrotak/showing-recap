'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getLog, updateLog, deleteLog, deletePhoto } from '@/lib/recall/supabase'
import { getSignedUrls, deletePhoto as deletePhotoFromStorage } from '@/lib/recall/storage'
import { downloadSinglePhoto } from '@/lib/recall/export'
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
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([])
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
  const [viewingMultiple, setViewingMultiple] = useState(false)
  const [showAddPhotoMenu, setShowAddPhotoMenu] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [trashedPhotos, setTrashedPhotos] = useState<any[]>([])
  const [showTrash, setShowTrash] = useState(false)

  useEffect(() => {
    loadLog()
  }, [resolvedParams.id])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setOpenDropdown(null)
      setShowAddPhotoMenu(false)
    }
    
    if (openDropdown || showAddPhotoMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [openDropdown, showAddPhotoMenu])

  useEffect(() => {
    console.log('useEffect triggered - log photos changed:', log?.photos?.length || 0)
    if (log?.photos && log.photos.length > 0) {
      console.log('Loading photo URLs for', log.photos.length, 'photos')
      loadPhotoUrls()
    } else {
      console.log('No photos, clearing URLs')
      setPhotoUrls({})
    }
  }, [log?.photos]) // Watch the entire photos array

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
    if (!log?.photos || log.photos.length === 0) {
      console.log('No photos to load URLs for')
      setPhotoUrls({})
      return
    }
    
    try {
      // Filter out photos without valid storage paths
      const validPhotos = log.photos.filter(p => p.storage_path && p.storage_path.trim())
      console.log('Loading URLs for', validPhotos.length, 'valid photos out of', log.photos.length, 'total')
      
      if (validPhotos.length === 0) {
        console.log('No valid storage paths found')
        setPhotoUrls({})
        return
      }
      
      const paths = validPhotos.map(p => p.storage_path)
      console.log('Requesting signed URLs for paths:', paths)
      
      const urls = await getSignedUrls(paths)
      console.log('Received URLs:', urls)
      
      // The getSignedUrls function returns URLs keyed by path
      // We need to use the storage_path as the key
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
    if (!photoId) {
      setError('Invalid photo ID')
      return
    }
    
    try {
      console.log('Moving photo to trash:', { photoId, storagePath })
      
      // Find the photo in current log
      const photoToTrash = log?.photos?.find(p => p.id === photoId)
      if (!photoToTrash) {
        setError('Photo not found')
        return
      }
      
      // Add to trashed photos (in memory for now)
      const trashedPhoto = {
        ...photoToTrash,
        trashedAt: new Date().toISOString(),
        originalLogId: log.id
      }
      
      setTrashedPhotos(prev => [...prev, trashedPhoto])
      
      // Remove from current log display
      if (log) {
        const updatedPhotos = log.photos?.filter(p => p.id !== photoId) || []
        setLog({
          ...log,
          photos: updatedPhotos
        })
        console.log('Moved to trash, remaining photos:', updatedPhotos.length)
      }
      
      // Remove from URLs and selections
      setPhotoUrls(prev => {
        const newUrls = { ...prev }
        if (storagePath) {
          delete newUrls[storagePath]
        }
        return newUrls
      })
      
      setSelectedPhotoIds(prev => prev.filter(id => id !== photoId))
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to move photo to trash'
      console.error('Error moving photo to trash:', {
        error: err,
        message: errorMessage,
        photoId,
        storagePath
      })
      setError(errorMessage)
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

  const togglePhotoSelection = (photoId: string) => {
    setSelectedPhotoIds(prev => 
      prev.includes(photoId) 
        ? prev.filter(id => id !== photoId)
        : [...prev, photoId]
    )
  }

  const handleViewSingle = (storagePath: string) => {
    if (photoUrls[storagePath]) {
      setSelectedPhoto(photoUrls[storagePath])
      setViewingMultiple(false)
      setCurrentPhotoIndex(0)
    }
  }

  const handleViewSelected = () => {
    if (selectedPhotoIds.length === 0) return
    
    // Find first selected photo URL
    const firstSelectedPhoto = log?.photos?.find(p => selectedPhotoIds.includes(p.id))
    if (firstSelectedPhoto && photoUrls[firstSelectedPhoto.storage_path]) {
      setSelectedPhoto(photoUrls[firstSelectedPhoto.storage_path])
      setViewingMultiple(selectedPhotoIds.length > 1)
      setCurrentPhotoIndex(0)
    }
  }

  const handleDownloadSelected = async () => {
    if (selectedPhotoIds.length === 0) return
    
    try {
      const selectedPhotos = log?.photos?.filter(p => selectedPhotoIds.includes(p.id)) || []
      for (const photo of selectedPhotos) {
        await downloadSinglePhoto(photo)
      }
    } catch (err) {
      console.error('Error downloading photos:', err)
      setError('Failed to download photos')
    }
  }

  const handleDeleteSelected = () => {
    if (selectedPhotoIds.length === 0) return
    setShowDeleteModal(true)
  }

  const confirmDeleteSelected = async () => {
    try {
      const selectedPhotos = log?.photos?.filter(p => selectedPhotoIds.includes(p.id)) || []
      
      // Move each selected photo to trash
      for (const photo of selectedPhotos) {
        const trashedPhoto = {
          ...photo,
          trashedAt: new Date().toISOString(),
          originalLogId: log?.id
        }
        setTrashedPhotos(prev => [...prev, trashedPhoto])
      }
      
      // Remove from current log display
      if (log) {
        setLog({
          ...log,
          photos: log.photos?.filter(p => !selectedPhotoIds.includes(p.id))
        })
      }
      
      // Remove from URLs and selections
      setPhotoUrls(prev => {
        const newUrls = { ...prev }
        selectedPhotos.forEach(photo => {
          if (photo.storage_path) {
            delete newUrls[photo.storage_path]
          }
        })
        return newUrls
      })
      
      setSelectedPhotoIds([])
      setShowDeleteModal(false)
      setDeleteConfirm('')
      
      console.log(`Moved ${selectedPhotos.length} photos to trash`)
    } catch (err) {
      console.error('Error moving photos to trash:', err)
      setError('Failed to move photos to trash')
    }
  }

  const navigatePhoto = (direction: 'prev' | 'next') => {
    if (!log?.photos || !viewingMultiple) return
    
    const selectedPhotos = log.photos.filter(p => selectedPhotoIds.includes(p.id))
    const newIndex = direction === 'next' 
      ? (currentPhotoIndex + 1) % selectedPhotos.length
      : (currentPhotoIndex - 1 + selectedPhotos.length) % selectedPhotos.length
    
    setCurrentPhotoIndex(newIndex)
    const nextPhoto = selectedPhotos[newIndex]
    if (nextPhoto && photoUrls[nextPhoto.storage_path]) {
      setSelectedPhoto(photoUrls[nextPhoto.storage_path])
    }
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || !log) return

    setUploading(true)
    try {
      // Import both upload and database functions
      const { uploadPhoto } = await import('@/lib/recall/storage')
      const { createPhoto } = await import('@/lib/recall/supabase')
      
      const newPhotos = []
      for (const file of Array.from(files)) {
        console.log('Uploading file:', file.name)
        
        // Step 1: Upload to storage
        const uploadResult = await uploadPhoto(file, log.case_id, log.id)
        console.log('Storage upload result:', uploadResult)
        
        // Step 2: Create database record
        const photoRecord = await createPhoto(log.id, uploadResult.path, file.name)
        console.log('Database record created:', photoRecord)
        
        newPhotos.push(photoRecord)
      }
      
      console.log('All new photos:', newPhotos)
      console.log('Current log photos:', log.photos?.length || 0)
      
      // Update local state with new photos
      const allPhotos = [...(log.photos || []), ...newPhotos]
      const updatedLog = {
        ...log,
        photos: allPhotos
      }
      
      console.log('Setting log with total photos:', allPhotos.length)
      setLog(updatedLog)
      
      // Load signed URLs for new photos
      loadPhotoUrls()
      
    } catch (err) {
      console.error('Error uploading photos:', err)
      setError('Failed to upload photos')
    } finally {
      setUploading(false)
      setShowAddPhotoMenu(false)
    }
  }

  const handleCameraCapture = () => {
    // Trigger file input with camera
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment'
    input.onchange = (e) => handleFileSelect(e as any)
    input.click()
    setShowAddPhotoMenu(false)
  }

  const handleCleanupOrphanedPhotos = async () => {
    if (!log?.photos) return
    
    const orphanedPhotos = log.photos.filter(p => !p.storage_path || !p.storage_path.trim())
    if (orphanedPhotos.length === 0) return
    
    const confirmed = window.confirm(`Remove ${orphanedPhotos.length} orphaned photo${orphanedPhotos.length > 1 ? 's' : ''} from database? These photos have no storage path and cannot be displayed.`)
    if (!confirmed) return
    
    try {
      // Delete orphaned photos from database
      for (const photo of orphanedPhotos) {
        await deletePhoto(photo.id)
      }
      
      // Update local state
      const validPhotos = log.photos.filter(p => p.storage_path && p.storage_path.trim())
      setLog({
        ...log,
        photos: validPhotos
      })
      
      console.log(`Cleaned up ${orphanedPhotos.length} orphaned photos`)
    } catch (err) {
      // Handle Supabase non-standard error objects
      const errorMessage = err && typeof err === 'object' && 'message' in err ? err.message : 'Unknown error'
      console.error('Error cleaning up orphaned photos:', {
        error: err,
        message: errorMessage,
        orphanedCount: orphanedPhotos.length
      })
      setError(`Failed to cleanup orphaned photos: ${errorMessage}`)
    }
  }

  const handleRestorePhoto = async (photoId: string) => {
    try {
      const photoToRestore = trashedPhotos.find(p => p.id === photoId)
      if (!photoToRestore || !log) return
      
      // Remove from trash
      setTrashedPhotos(prev => prev.filter(p => p.id !== photoId))
      
      // Add back to log photos
      const restoredPhoto = {
        id: photoToRestore.id,
        storage_path: photoToRestore.storage_path,
        original_filename: photoToRestore.original_filename,
        created_at: photoToRestore.created_at
      }
      
      setLog({
        ...log,
        photos: [...(log.photos || []), restoredPhoto]
      })
      
      console.log('Photo restored from trash')
    } catch (err) {
      console.error('Error restoring photo:', err)
      setError('Failed to restore photo')
    }
  }

  const handlePermanentDelete = async (photoId: string, storagePath: string) => {
    const confirmed = window.confirm('Permanently delete this photo? This cannot be undone.')
    if (!confirmed) return
    
    try {
      // Delete from storage
      if (storagePath && storagePath.trim()) {
        await deletePhotoFromStorage(storagePath)
      }
      
      // Delete from database
      await deletePhoto(photoId)
      
      // Remove from trash
      setTrashedPhotos(prev => prev.filter(p => p.id !== photoId))
      
      console.log('Photo permanently deleted')
    } catch (err) {
      console.error('Error permanently deleting photo:', err)
      setError('Failed to permanently delete photo')
    }
  }

  const handleEmptyTrash = async () => {
    if (trashedPhotos.length === 0) return
    
    const confirmed = window.confirm(`Permanently delete all ${trashedPhotos.length} photos in trash? This cannot be undone.`)
    if (!confirmed) return
    
    try {
      for (const photo of trashedPhotos) {
        // Delete from storage
        if (photo.storage_path && photo.storage_path.trim()) {
          await deletePhotoFromStorage(photo.storage_path)
        }
        
        // Delete from database
        await deletePhoto(photo.id)
      }
      
      setTrashedPhotos([])
      console.log('Trash emptied')
    } catch (err) {
      console.error('Error emptying trash:', err)
      setError('Failed to empty trash')
    }
  }

  const handleViewAllPhotos = () => {
    if (!log?.photos || log.photos.length === 0) return
    
    const validPhotos = log.photos.filter(p => p.storage_path && photoUrls[p.storage_path])
    if (validPhotos.length === 0) return
    
    // Set all photos as "selected" for viewing purposes
    setSelectedPhotoIds(validPhotos.map(p => p.id))
    
    // Start with first photo
    setSelectedPhoto(photoUrls[validPhotos[0].storage_path])
    setViewingMultiple(validPhotos.length > 1)
    setCurrentPhotoIndex(0)
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
                Photos ({log.photos.filter(p => p.storage_path && p.storage_path.trim()).length})
                {log.photos.length > 6 && (
                  <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                    Many photos
                  </span>
                )}
                {log.photos.length !== log.photos.filter(p => p.storage_path && p.storage_path.trim()).length && (
                  <span 
                    className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full cursor-pointer hover:bg-yellow-200"
                    title={`${log.photos.length - log.photos.filter(p => p.storage_path && p.storage_path.trim()).length} photos have invalid storage paths and won't display`}
                    onClick={() => handleCleanupOrphanedPhotos()}
                  >
                    {log.photos.length - log.photos.filter(p => p.storage_path && p.storage_path.trim()).length} orphaned
                  </span>
                )}
              </h2>
              
              {/* Multi-Select Controls */}
              <div className="flex items-center space-x-2">
                {selectedPhotoIds.length > 0 && (
                  <>
                    <span className="text-sm text-gray-600">
                      {selectedPhotoIds.length} selected
                    </span>
                    <button
                      onClick={() => setSelectedPhotoIds([])}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Clear
                    </button>
                  </>
                )}
                
                {/* Single Action Button */}
                <div className="relative">
                  {selectedPhotoIds.length > 0 ? (
                    <button
                      onClick={() => setOpenDropdown(openDropdown === 'actions' ? null : 'actions')}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-1 shadow-sm"
                    >
                      <span>Actions ({selectedPhotoIds.length})</span>
                      <span className="text-lg">⋮</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleViewAllPhotos}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-1 shadow-sm"
                    >
                      <span>👁️</span>
                      <span>View All</span>
                    </button>
                  )}
                  
                  {/* Actions dropdown for selected photos */}
                  {openDropdown === 'actions' && selectedPhotoIds.length > 0 && (
                    <div className="absolute right-0 top-12 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 min-w-[160px]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleViewSelected()
                          setOpenDropdown(null)
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                      >
                        <span>👁️</span>
                        <span>View Selected</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDownloadSelected()
                          setOpenDropdown(null)
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                      >
                        <span>⬇️</span>
                        <span>Download Selected</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteSelected()
                          setOpenDropdown(null)
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                      >
                        <span>🗑️</span>
                        <span>Delete Selected</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className={`grid gap-2 mb-3 ${
              log.photos.filter(photo => photo.storage_path && photo.storage_path.trim()).length <= 2 
                ? 'grid-cols-2' 
                : log.photos.filter(photo => photo.storage_path && photo.storage_path.trim()).length <= 4
                ? 'grid-cols-2 sm:grid-cols-3'
                : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
            }`}>
              {(() => {
                const validPhotos = log.photos.filter(photo => photo.storage_path && photo.storage_path.trim())
                console.log('Rendering photo grid:', {
                  totalPhotos: log.photos.length,
                  validPhotos: validPhotos.length,
                  photoUrls: Object.keys(photoUrls).length,
                  urls: photoUrls
                })
                return validPhotos.map((photo, index) => (
                  <div key={`photo-grid-${photo.id}-${index}`} className="relative">
                    {photoUrls[photo.storage_path] ? (
                      <div className="relative group">
                        {/* Selection checkbox */}
                        <input
                          type="checkbox"
                          checked={selectedPhotoIds.includes(photo.id)}
                          onChange={() => togglePhotoSelection(photo.id)}
                          className="absolute top-2 left-2 w-6 h-6 z-10 accent-blue-600 cursor-pointer"
                        />
                        
                        {/* Individual photo menu */}
                        <div className="absolute top-2 right-2 z-10">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setOpenDropdown(openDropdown === photo.id ? null : photo.id)
                            }}
                            className="bg-white bg-opacity-80 hover:bg-opacity-100 text-gray-700 p-1 rounded-full shadow-sm transition-all"
                          >
                            <span className="text-sm">⋮</span>
                          </button>
                          
                          {/* Individual photo dropdown */}
                          {openDropdown === photo.id && (
                            <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 min-w-[140px]">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleViewSingle(photo.storage_path)
                                  setOpenDropdown(null)
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                              >
                                <span>👁️</span>
                                <span>View</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDownloadSingle(photo)
                                  setOpenDropdown(null)
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                              >
                                <span>⬇️</span>
                                <span>Download</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeletePhoto(photo.id, photo.storage_path)
                                  setOpenDropdown(null)
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                              >
                                <span>🗑️</span>
                                <span>Delete</span>
                              </button>
                            </div>
                          )}
                        </div>
                        
                        <img
                          src={photoUrls[photo.storage_path]}
                          alt={photo.original_filename || 'Photo'}
                          className={`w-full h-24 object-cover rounded-lg border-2 cursor-pointer transition-all ${
                            selectedPhotoIds.includes(photo.id)
                              ? 'border-blue-500 opacity-90'
                              : 'border-gray-200 hover:opacity-90'
                          }`}
                          onClick={() => togglePhotoSelection(photo.id)}
                          onLoad={() => console.log('Image loaded successfully for:', photo.storage_path)}
                          onError={() => console.log('Image failed to load for:', photo.storage_path)}
                        />
                      </div>
                    ) : (
                      <div className="w-full h-24 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <span className="ml-2 text-xs text-gray-500">Loading...</span>
                      </div>
                    )}
                  </div>
                ))
              })()}
            </div>
          </div>
        )}

        {/* Add Photo Section */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Add Photos</h3>
            <div className="relative">
              <button
                onClick={() => setShowAddPhotoMenu(!showAddPhotoMenu)}
                disabled={uploading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2"
              >
                <span>📷</span>
                <span>{uploading ? 'Uploading...' : 'Add Photos'}</span>
              </button>
              
              {/* Add Photo Menu */}
              {showAddPhotoMenu && (
                <div className="absolute right-0 top-12 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 min-w-[160px]">
                  <button
                    onClick={handleCameraCapture}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                  >
                    <span>📸</span>
                    <span>Take Photo</span>
                  </button>
                  <label className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2 cursor-pointer">
                    <span>🖼️</span>
                    <span>Choose from Gallery</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Additional Actions Space */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <button className="bg-green-50 hover:bg-green-100 text-green-700 font-medium py-3 px-4 rounded-lg text-sm border border-green-200 transition-colors">
              📄 Export PDF
            </button>
            <button className="bg-purple-50 hover:bg-purple-100 text-purple-700 font-medium py-3 px-4 rounded-lg text-sm border border-purple-200 transition-colors">
              📋 Copy Details
            </button>
          </div>
        </div>

        {/* Delete Log and Trash Section */}
        <div className="flex gap-4">
          {/* Delete Log Section - Main */}
          <div className="flex-1 bg-red-50 border border-red-200 rounded-lg p-4">
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

          {/* Trash/Recover Section */}
          <div className="w-1/4 bg-gray-50 border border-gray-300 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-800 text-sm">Trash/Recover</h4>
              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
                {trashedPhotos.length}
              </span>
            </div>
            
            {trashedPhotos.length === 0 ? (
              <div className="text-center py-4">
                <div className="text-2xl mb-1">🗑️</div>
                <p className="text-xs text-gray-500">No deleted photos</p>
              </div>
            ) : (
              <>
                {/* Trash Controls */}
                <div className="mb-3">
                  <button
                    onClick={() => setShowTrash(!showTrash)}
                    className="w-full text-sm text-gray-600 hover:text-gray-800 py-1 px-2 rounded border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    {showTrash ? 'Hide' : 'Show'} Trash
                  </button>
                </div>

                {/* Trash Content */}
                {showTrash && (
                  <div className="space-y-2">
                    <div className="max-h-32 overflow-y-auto">
                      <div className="grid grid-cols-2 gap-1">
                        {trashedPhotos.map((photo) => (
                          <div key={`trash-${photo.id}`} className="relative group">
                            <div className="w-full h-12 bg-gray-200 rounded border text-xs text-gray-500 flex items-center justify-center">
                              {photo.original_filename ? photo.original_filename.substring(0, 6) + '...' : 'Photo'}
                            </div>
                            <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center space-x-1">
                              <button
                                onClick={() => handleRestorePhoto(photo.id)}
                                className="bg-green-500 text-white p-1 rounded text-xs"
                                title="Restore"
                              >
                                ↺
                              </button>
                              <button
                                onClick={() => handlePermanentDelete(photo.id, photo.storage_path)}
                                className="bg-red-500 text-white p-1 rounded text-xs"
                                title="Delete Forever"
                              >
                                ✖
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <button
                      onClick={handleEmptyTrash}
                      className="w-full text-xs text-red-600 hover:text-red-800 py-1 px-2 rounded border border-red-200 hover:bg-red-50 transition-colors"
                    >
                      Empty Trash
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Photo Modal */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"
          onClick={() => {
            setSelectedPhoto(null)
            setViewingMultiple(false)
            setCurrentPhotoIndex(0)
          }}
        >
          {/* Back Button */}
          <button
            onClick={() => {
              setSelectedPhoto(null)
              setViewingMultiple(false)
              setCurrentPhotoIndex(0)
            }}
            className="fixed top-4 left-4 z-60 bg-white bg-opacity-90 hover:bg-opacity-100 text-gray-800 px-4 py-2 rounded-lg text-lg font-semibold flex items-center space-x-2 shadow-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Back</span>
          </button>
          
          {/* Navigation arrows for multiple photos */}
          {viewingMultiple && selectedPhotoIds.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  navigatePhoto('prev')
                }}
                className="fixed left-4 top-1/2 transform -translate-y-1/2 z-60 bg-white bg-opacity-90 hover:bg-opacity-100 text-gray-800 p-3 rounded-full shadow-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  navigatePhoto('next')
                }}
                className="fixed right-4 top-1/2 transform -translate-y-1/2 z-60 bg-white bg-opacity-90 hover:bg-opacity-100 text-gray-800 p-3 rounded-full shadow-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              
              {/* Photo counter */}
              <div className="fixed top-4 right-4 z-60 bg-black bg-opacity-50 text-white px-3 py-1 rounded-lg text-sm">
                {currentPhotoIndex + 1} of {selectedPhotoIds.length}
              </div>
            </>
          )}
          
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
            {selectedPhotoIds.length > 0 ? (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Move {selectedPhotoIds.length} Photos to Trash
                </h3>
                <p className="text-gray-600 text-sm mb-4">
                  {selectedPhotoIds.length} selected photo{selectedPhotoIds.length > 1 ? 's' : ''} will be moved to trash. You can restore them later if needed.
                </p>
                <div className="flex space-x-2">
                  <button
                    onClick={confirmDeleteSelected}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg text-sm"
                  >
                    Move to Trash
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteModal(false)
                      setDeleteConfirm('')
                    }}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
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
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium py-2 px-4 rounded-lg text-sm"
                  >
                    Delete Log
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteModal(false)
                      setDeleteConfirm('')
                    }}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}