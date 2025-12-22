import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { inngest } from '@/lib/inngest'

export async function POST(request: NextRequest) {
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

    return NextResponse.json({
      success: true,
      request_id: syncRequest.id,
      message: `Sync triggered for ${app_id}`,
    })
  } catch (error) {
    console.error('Error triggering sync:', error)
    return NextResponse.json(
      { error: 'Failed to trigger sync', details: String(error) },
      { status: 500 }
    )
  }
}

// Cancel a pending sync request
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const request_id = searchParams.get('request_id')

    if (!request_id) {
      return NextResponse.json(
        { error: 'request_id is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('sync_requests')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        error_message: 'Cancelled by user',
      })
      .eq('id', request_id)
      .eq('status', 'pending')
      .select()
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: 'Request not found or not cancellable' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Sync request cancelled',
    })
  } catch (error) {
    console.error('Error cancelling sync:', error)
    return NextResponse.json(
      { error: 'Failed to cancel sync', details: String(error) },
      { status: 500 }
    )
  }
}
