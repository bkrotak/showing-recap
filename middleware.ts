import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes that don't require authentication
  const publicRoutes = [
    '/login',
    '/api/sms/send', // For SMS functionality
    '/', // Home page
  ]

  // Feedback routes (public)
  const isFeedbackRoute = pathname.startsWith('/r/')
  
  // Check if route is public
  const isPublicRoute = publicRoutes.includes(pathname) || isFeedbackRoute

  // Let the AuthProvider handle redirects for protected routes
  // This middleware is mainly for static route protection
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}