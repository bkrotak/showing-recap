import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      buyer_name,
      buyer_phone,
      buyer_email,
      address,
      city,
      state,
      zip,
      showing_datetime
    } = body

    // Basic validation
    if (!buyer_name || !buyer_phone || !address || !city || !state || !zip || !showing_datetime) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate phone format (basic E.164 check)
    if (!buyer_phone.startsWith('+') || buyer_phone.length < 10) {
      return NextResponse.json(
        { error: 'Phone must be in E.164 format (e.g., +1234567890)' },
        { status: 400 }
      )
    }

    // Get authenticated user
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'No authorization header' },
        { status: 401 }
      )
    }

    // Verify the user with the provided token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication' },
        { status: 401 }
      )
    }

    // Generate secure public token using crypto.randomUUID
    const public_token = crypto.randomUUID()

    // Insert showing with server-side admin client
    const { data, error } = await supabaseAdmin
      .from('showings')
      .insert({
        agent_id: user.id,
        public_token,
        buyer_name: buyer_name.trim(),
        buyer_phone: buyer_phone.trim(),
        buyer_email: buyer_email?.trim() || null,
        address: address.trim(),
        city: city.trim(),
        state: state.trim().toUpperCase(),
        zip: zip.trim(),
        showing_datetime: new Date(showing_datetime).toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to create showing' },
        { status: 500 }
      )
    }

    // Return the showing with public URL
    const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL}/r/${data.public_token}`

    return NextResponse.json({
      showing: data,
      publicUrl
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}