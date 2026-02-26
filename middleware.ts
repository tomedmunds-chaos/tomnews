import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const password = process.env.APP_PASSWORD
  if (!password) return NextResponse.next() // No password set = open

  const cookie = request.cookies.get('auth')
  if (cookie?.value === password) return NextResponse.next()

  // Allow the auth endpoint through
  if (request.nextUrl.pathname === '/api/auth') return NextResponse.next()

  // Redirect to login
  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  matcher: ['/((?!login|_next|favicon).*)'],
}
