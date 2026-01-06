'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-provider'
import { getCases, searchCases, getDeletedCases, restoreCase } from '@/lib/recall/supabase'
import { RecallCaseWithLogs } from '@/lib/recall/types'

export default function RecallHomePage() {
  const { user, signOut } = useAuth()
  const [cases, setCases] = useState<RecallCaseWithLogs[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(0)
  const [hasMorePages, setHasMorePages] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [showTrash, setShowTrash] = useState(false)
  
  const CASES_PER_PAGE = 10

  useEffect(() => {
    if (user) {
      loadCases()
    }
  }, [user])

  // Add focus listener to refresh cases when user returns to the tab/page
  useEffect(() => {
    const handleFocus = () => {
      if (user) {
        console.log('Page focused, refreshing cases')
        loadCases()
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [user])

  const loadCases = async (page = 0, append = false) => {
    try {
      if (!append) {
        setLoading(true)
        setCurrentPage(0)
      } else {
        setLoadingMore(true)
      }
      setError('')
      console.log('Fetching cases...')
      
      // Fetch one more than we need to check if there are more pages
      const offset = page * CASES_PER_PAGE
      const data = await getCases(CASES_PER_PAGE + 1, offset)
      console.log('Received cases:', data.length)
      
      // Check if there are more pages
      const hasMore = data.length > CASES_PER_PAGE
      const displayData = hasMore ? data.slice(0, CASES_PER_PAGE) : data
      
      setHasMorePages(hasMore)
      
      if (append) {
        setCases(prev => [...prev, ...displayData])
        setCurrentPage(page)
      } else {
        setCases(displayData)
        setCurrentPage(0)
      }
    } catch (err) {
      console.error('Error loading cases:', err)
      setError('Failed to load cases')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (!query.trim()) {
      loadCases()
      return
    }

    try {
      setError('')
      setLoading(true)
      const data = await searchCases({ query })
      setCases(data)
      setHasMorePages(false) // No pagination for search results
    } catch (err) {
      console.error('Error searching cases:', err)
      setError('Search failed')
    } finally {
      setLoading(false)
    }
  }

  const loadMoreCases = async () => {
    if (loadingMore || !hasMorePages || searchQuery) return
    await loadCases(currentPage + 1, true)
  }

  const loadTrashCases = async () => {
    console.log('loadTrashCases called')
    try {
      setLoading(true)
      setError('')
      console.log('Fetching deleted cases...')
      const data = await getDeletedCases(50) // Get up to 50 deleted cases
      console.log('Received deleted cases:', data.length)
      setCases(data)
      setHasMorePages(false) // No pagination for trash view
    } catch (err) {
      console.error('Error loading deleted cases:', err)
      setError('Failed to load deleted cases')
    } finally {
      setLoading(false)
    }
  }

  const toggleTrash = () => {
    const newShowTrash = !showTrash
    setShowTrash(newShowTrash)
    setSearchQuery('') // Clear search when switching views
    
    if (newShowTrash) {
      loadTrashCases()
    } else {
      loadCases()
    }
  }

  const handleRestore = async (caseId: string) => {
    try {
      await restoreCase(caseId)
      // Reload the current view
      if (showTrash) {
        loadTrashCases()
      } else {
        loadCases()
      }
    } catch (err) {
      console.error('Error restoring case:', err)
      setError('Failed to restore case')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading cases...</p>
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
            <h1 className="text-2xl font-bold text-gray-900">
              {showTrash ? 'Trash' : 'Recall'}
            </h1>
            <div className="flex items-center space-x-3">
              <button
                onClick={loadCases}
                disabled={loading}
                className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
                title="Refresh cases"
              >
                <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0V9a8 8 0 1115.356 2M15 15v5h-.582M4.644 15A8.001 8.001 0 0019.418 15m0 0V15a8 8 0 11-15.356-2" />
                </svg>
              </button>
              <button
                onClick={toggleTrash}
                className={`${showTrash ? 'text-red-600' : 'text-gray-500 hover:text-gray-700'}`}
                title={showTrash ? "Back to active cases" : "View deleted cases"}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <span className="text-xs text-gray-500">{user?.email}</span>
              <Link 
                href="/recall/settings"
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Link>
              <button
                onClick={signOut}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Search cases and notes..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full px-4 py-3 pl-10 bg-white border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="max-w-md mx-auto px-4 mb-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* New Case Button */}
      {!showTrash && (
        <div className="max-w-md mx-auto px-4 mb-6">
          <Link
            href="/recall/case/new"
            className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-4 px-6 rounded-lg text-center text-lg transition-colors"
          >
            + New Case
          </Link>
        </div>
      )}

      {/* Cases List */}
      <div className="max-w-md mx-auto px-4 pb-8">
        {cases.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {showTrash ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                )}
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {showTrash ? 'Trash is empty' : 'No cases yet'}
            </h3>
            <p className="text-gray-500 mb-6">
              {showTrash 
                ? 'No deleted cases to show. Deleted cases will appear here and can be restored.'
                : (searchQuery ? 'No cases match your search.' : 'Create your first case to get started.')
              }
            </p>
            {searchQuery && !showTrash && (
              <button 
                onClick={() => handleSearch('')}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {cases.map((case_) => (
              <div
                key={case_.id}
                className={`bg-white border rounded-lg p-4 transition-all ${
                  showTrash 
                    ? 'border-red-200 bg-red-50' 
                    : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    {showTrash ? (
                      <h3 className="font-medium text-gray-700 text-lg leading-6">
                        {case_.title}
                      </h3>
                    ) : (
                      <Link href={`/recall/case/${case_.id}`}>
                        <h3 className="font-medium text-gray-900 text-lg leading-6 hover:text-blue-600">
                          {case_.title}
                        </h3>
                      </Link>
                    )}
                    <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                      {showTrash 
                        ? `Deleted ${formatDate(case_.deleted_at)}`
                        : formatDate(case_.updated_at)
                      }
                    </span>
                  </div>
                  
                  {showTrash && (
                    <button
                      onClick={() => handleRestore(case_.id)}
                      className="ml-2 bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 rounded transition-colors"
                      title="Restore case"
                    >
                      Restore
                    </button>
                  )}
                </div>
                
                {case_.client_name && (
                  <p className={`text-sm mb-1 ${showTrash ? 'text-gray-600' : 'text-gray-600'}`}>
                    Client: {case_.client_name}
                  </p>
                )}
                
                {case_.location_text && (
                  <p className={`text-sm mb-2 ${showTrash ? 'text-gray-500' : 'text-gray-500'}`}>
                    📍 {case_.location_text}
                  </p>
                )}
                
                <div className={`flex items-center justify-between text-sm ${showTrash ? 'text-gray-500' : 'text-gray-500'}`}>
                  <div className="flex items-center space-x-4">
                    <span>{case_.log_count || 0} logs</span>
                    {(case_.photo_count || 0) > 0 && (
                      <span>📷 {case_.photo_count}</span>
                    )}
                  </div>
                  {!showTrash && (
                    <Link href={`/recall/case/${case_.id}`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Pagination */}
        {!searchQuery && hasMorePages && (
          <div className="mt-6">
            <button
              onClick={loadMoreCases}
              disabled={loadingMore}
              className="w-full bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 text-gray-700 font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
            >
              {loadingMore ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                  Loading more...
                </>
              ) : (
                <>
                  Load More Cases
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}