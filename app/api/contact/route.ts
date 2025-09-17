import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, message } = body

    // Basic validation
    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Forward the form data to Formspree
    const formspreeResponse = await fetch('https://formspree.io/f/mqadvbog', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ name, email, message }),
    })

    const data = await formspreeResponse.json()

    if (!formspreeResponse.ok) {
      console.error('Formspree error:', data)
      return NextResponse.json({ error: 'Form submission failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Message sent via Formspree!' }, { status: 200 })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
