import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import twilio from 'twilio'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { showingId, message } = await request.json()

    // Validate Twilio configuration
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
      return NextResponse.json(
        { error: 'Twilio not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER environment variables.' },
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

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication' },
        { status: 401 }
      )
    }

    // Get showing details and verify ownership
    const { data: showing, error: showingError } = await supabaseAdmin
      .from('showings')
      .select('*')
      .eq('id', showingId)
      .eq('agent_id', user.id)
      .single()

    if (showingError || !showing) {
      return NextResponse.json(
        { error: 'Showing not found or access denied' },
        { status: 404 }
      )
    }

    // Initialize Twilio client
    const twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    )

    // Prepare SMS message
    const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL}/r/${showing.public_token}`
    const smsBody = message || 
      `Hi ${showing.buyer_name}! Here's the link to provide feedback on your showing at ${showing.address}: ${publicUrl}`

    // Send SMS
    const smsResult = await twilioClient.messages.create({
      body: smsBody,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: showing.buyer_phone
    })

    console.log('SMS sent successfully:', smsResult.sid)

    return NextResponse.json({
      success: true,
      messageSid: smsResult.sid,
      to: showing.buyer_phone
    })

  } catch (error) {
    console.error('SMS sending error:', error)
    
    // Handle specific Twilio errors
    if (error && typeof error === 'object' && 'code' in error) {
      const twilioError = error as any
      switch (twilioError.code) {
        case 21211:
          return NextResponse.json(
            { error: 'Invalid phone number format. Please use E.164 format (e.g., +1234567890)' },
            { status: 400 }
          )
        case 21608:
          return NextResponse.json(
            { error: 'The phone number is not reachable or invalid' },
            { status: 400 }
          )
        case 21614:
          return NextResponse.json(
            { error: 'SMS not supported for this phone number' },
            { status: 400 }
          )
        default:
          return NextResponse.json(
            { error: `Twilio error: ${twilioError.message}` },
            { status: 400 }
          )
      }
    }

    return NextResponse.json(
      { error: 'Failed to send SMS' },
      { status: 500 }
    )
  }
}