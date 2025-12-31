import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase'
import { inngest } from '@/lib/inngest'
import { env } from '@/lib/env'

// Authentication helper
function isAuthenticated(request: NextRequest): boolean {
  // Check API key header
  const apiKey = request.headers.get('x-api-key')
  if (env.SYNC_API_KEY && apiKey === env.SYNC_API_KEY) {
    return true
  }

  // Allow internal requests (same origin) in development or when no API key is configured
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  const host = request.headers.get('host')

  // In development or if no API key is set, allow same-origin requests
  if (!env.SYNC_API_KEY || env.NODE_ENV === 'development') {
    if (origin && host && origin.includes(host)) return true
    if (referer && host && referer.includes(host)) return true
    // Allow requests with no origin (server-side or same-origin fetch)
    if (!origin && !referer) return true
  }

  return false
}

export async function POST(request: NextRequest) {
  // Check authentication
  if (!isAuthenticated(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const { app_id, direction = 'both', entity_types, triggered_by } = body

    if (!app_id) {
      return NextResponse.json(
        { error: 'app_id is required' },
        { status: 400 }
      )
    }

    // Check if app exists and is enabled
    const { data: app, error: appError } = await supabaseAdmin
      .from('sync_apps')
      .select('id, is_enabled')
      .eq('id', app_id)
      .single()

    if (appError || !app) {
      return NextResponse.json(
        { error: `App not found: ${app_id}` },
        { status: 404 }
      )
    }

    if (!app.is_enabled) {
      return NextResponse.json(
        { error: `App is disabled: ${app_id}` },
        { status: 400 }
      )
    }

    // Check for existing pending/processing request
    const { data: existing } = await supabaseAdmin
      .from('sync_requests')
      .select('id, status')
      .eq('app_id', app_id)
      .in('status', ['pending', 'processing'])
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: 'Sync already pending or in progress', existing_request: existing[0] },
        { status: 409 }
      )
    }

    // Create sync request
    const { data: syncRequest, error: requestError } = await supabaseAdmin
      .from('sync_requests')
      .insert({
        app_id,
        direction,
        entity_types,
        requested_by: triggered_by || 'manual',
      })
      .select()
      .single()

    if (requestError) {
      throw requestError
    }

    // Trigger Inngest function
    await inngest.send({
      name: 'sync/trigger',
      data: {
        app_id,
        direction,
        entity_types,
        request_id: syncRequest.id,
        triggered_by: triggered_by || 'manual',
      },
    })

    // Revalidate the dashboard
    revalidatePath('/')

    return NextResponse.json({
      success: true,
      request_id: syncRequest.id,
      message: `Sync triggered for ${app_id}`,
    })
  } catch (error) {
    console.error('Error triggering sync:', error)
    return NextResponse.json(
      { error: 'Failed to trigger sync' },
      { status: 500 }
    )
  }
}

// Cancel a pending or processing sync request
export async function DELETE(request: NextRequest) {
  // Check authentication
  if (!isAuthenticated(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const request_id = searchParams.get('request_id')

    if (!request_id) {
      return NextResponse.json(
        { error: 'request_id is required' },
        { status: 400 }
      )
    }

    // First check if request exists and is cancellable
    const { data: existing } = await supabaseAdmin
      .from('sync_requests')
      .select('id, status, app_id')
      .eq('id', request_id)
      .in('status', ['pending', 'processing'])
      .single()

    if (!existing) {
      return NextResponse.json(
        { error: 'Request not found or not cancellable (only pending/processing requests can be cancelled)' },
        { status: 404 }
      )
    }

    // Cancel the request
    const { error } = await supabaseAdmin
      .from('sync_requests')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        error_message: existing.status === 'processing'
          ? 'Cancelled by user (job may still complete)'
          : 'Cancelled by user',
      })
      .eq('id', request_id)

    if (error) {
      throw error
    }

    // If the request was processing, try to cancel the Inngest function
    // Note: This is a best-effort cancellation - the job may still complete
    if (existing.status === 'processing') {
      try {
        await inngest.send({
          name: 'sync/cancel',
          data: { request_id, app_id: existing.app_id },
        })
      } catch (cancelError) {
        // Log but don't fail - the request is already marked cancelled
        console.warn('Could not send cancel event to Inngest:', cancelError)
      }
    }

    // Revalidate the dashboard
    revalidatePath('/')

    return NextResponse.json({
      success: true,
      message: existing.status === 'processing'
        ? 'Sync request cancelled (running job may still complete)'
        : 'Sync request cancelled',
      was_processing: existing.status === 'processing',
    })
  } catch (error) {
    console.error('Error cancelling sync:', error)
    return NextResponse.json(
      { error: 'Failed to cancel sync' },
      { status: 500 }
    )
  }
}
