/**
 * Auth0-based Carousel Content API Endpoint
 * Handles carousel content with Auth0 integration
 */

import type { APIRoute } from 'astro'
import { validateToken } from '@/lib/auth/auth0-jwt-service'
import { extractTokenFromRequest } from '@/lib/auth/auth0-middleware'
import { getUserById } from '@/services/auth0.service'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { createAuditLog } from '@/lib/audit'

export const prerender = false

const logger = createBuildSafeLogger('auth0-carousel-content-api')

interface CarouselItem {
  id: string
  title: string
  description: string
  content?: string
  image?: string
  link?: string
  metadata?: {
    priority: number
    category: string
    tags: string[]
    publishDate: string
    expiryDate?: string
    targetAudience: string[]
  }
}

interface CarouselConfiguration {
  id: string
  name: string
  description: string
  effect: 'slide' | 'fade' | 'coverflow' | 'flip' | 'cube'
  autoplay: boolean | { delay: number; disableOnInteraction?: boolean }
  navigation: boolean
  pagination: boolean | { clickable?: boolean; dynamicBullets?: boolean }
  loop: boolean
  slidesPerView: number | 'auto'
  spaceBetween: number
  centeredSlides: boolean
  breakpoints?: Record<number, any>
  items: CarouselItem[]
}

interface CarouselContentResponse {
  configurations: CarouselConfiguration[]
  metadata: {
    totalConfigurations: number
    lastUpdated: string
    cacheExpiry: string
  }
}

/**
 * Carousel Content API
 * GET /api/auth/auth0-carousel-content
 *
 * Provides dynamic content and configurations for SwiperCarousel components
 */
export const GET: APIRoute = async ({ request }) => {
  try {
    // Extract token from request
    const token = extractTokenFromRequest(request as unknown as Request)

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Validate token
    const validation = await validateToken(token, 'access')

    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Get user from Auth0
    const user = await getUserById(validation.userId!)

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Parse query parameters
    const url = new URL(request.url)
    const configId = url.searchParams.get('configId')
    const category = url.searchParams.get('category')
    const audience = url.searchParams.get('audience') || 'all'
    const includeExpired = url.searchParams.get('includeExpired') === 'true'

    // Generate carousel configurations based on therapy platform needs
    const configurations = generateCarouselConfigurations(
      audience,
      includeExpired,
    )

    // Filter by specific configuration if requested
    let filteredConfigurations = configurations
    if (configId) {
      filteredConfigurations = configurations.filter(
        (config) => config.id === configId,
      )
    }

    if (category) {
      filteredConfigurations = filteredConfigurations.filter((config) =>
        config.items.some((item) => item.metadata?.category === category),
      )
    }

    const response: CarouselContentResponse = {
      configurations: filteredConfigurations,
      metadata: {
        totalConfigurations: filteredConfigurations.length,
        lastUpdated: new Date().toISOString(),
        cacheExpiry: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
      },
    }

    // Create audit log
    await createAuditLog(
      'carousel_content_access',
      'auth.components.ui.carousel.content.access',
      user.id,
      'auth-components-ui',
      {
        action: 'get_carousel_content',
        configCount: filteredConfigurations.length,
        configId,
        category,
        audience
      }
    )

    logger.info('Retrieved carousel content configurations', {
      configCount: filteredConfigurations.length,
      configId,
      category,
      audience,
      userId: user.id,
    })

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=1800', // 30-minute cache
      },
    })
  } catch (error: unknown) {
    logger.error('Error retrieving carousel content', { error })

    // Create audit log for the error
    await createAuditLog(
      'system_error',
      'auth.components.ui.carousel.content.error',
      'anonymous',
      'auth-components-ui',
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }
    )

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

/**
 * POST endpoint for creating/updating carousel configurations
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    // Extract token from request
    const token = extractTokenFromRequest(request as unknown as Request)

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Validate token
    const validation = await validateToken(token, 'access')

    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Get user from Auth0
    const user = await getUserById(validation.userId!)

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const body = await request.json()
    const { configuration, action } = body

    if (!configuration || !action) {
      return new Response(
        JSON.stringify({ error: 'configuration and action are required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Validate configuration structure
    if (
      !configuration.name ||
      !configuration.items ||
      !Array.isArray(configuration.items)
    ) {
      return new Response(
        JSON.stringify({ error: 'Invalid configuration format' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const configurationId = configuration.id || `config-${Date.now()}`
    const timestamp = new Date().toISOString()

    const processedConfiguration: CarouselConfiguration = {
      id: configurationId,
      name: configuration.name,
      description: configuration.description || '',
      effect: configuration.effect || 'slide',
      autoplay: configuration.autoplay || false,
      navigation: configuration.navigation !== false,
      pagination: configuration.pagination !== false,
      loop: configuration.loop !== false,
      slidesPerView: configuration.slidesPerView || 1,
      spaceBetween: configuration.spaceBetween || 30,
      centeredSlides: configuration.centeredSlides || false,
      breakpoints: configuration.breakpoints,
      items: configuration.items.map((item: any, index: number) => ({
        id: item.id || `item-${Date.now()}-${index}`,
        title: item.title || '',
        description: item.description || '',
        content: item.content,
        image: item.image,
        link: item.link,
        metadata: {
          priority: item.metadata?.priority || 1,
          category: item.metadata?.category || 'general',
          tags: item.metadata?.tags || [],
          publishDate: item.metadata?.publishDate || timestamp,
          expiryDate: item.metadata?.expiryDate,
          targetAudience: item.metadata?.targetAudience || ['all'],
        },
      })),
    }

    // Create audit log
    await createAuditLog(
      'carousel_configuration_processed',
      'auth.components.ui.carousel.content.process',
      user.id,
      'auth-components-ui',
      {
        action,
        configId: configurationId,
        itemCount: processedConfiguration.items.length,
        effect: processedConfiguration.effect
      }
    )

    // TODO: Save to database
    // const repository = new UIContentRepository()
    // await repository.saveCarouselConfiguration(processedConfiguration)

    logger.info('Processed carousel configuration', {
      action,
      configId: configurationId,
      itemCount: processedConfiguration.items.length,
      effect: processedConfiguration.effect,
      userId: user.id,
    })

    return new Response(
      JSON.stringify({
        success: true,
        configuration: processedConfiguration,
        action,
        timestamp,
      }),
      {
        status: action === 'create' ? 201 : 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error: unknown) {
    logger.error('Error processing carousel configuration', { error })

    // Create audit log for the error
    await createAuditLog(
      'system_error',
      'auth.components.ui.carousel.content.error',
      'anonymous',
      'auth-components-ui',
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }
    )

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

// Helper function to generate carousel configurations
function generateCarouselConfigurations(
  audience: string,
  includeExpired: boolean,
): CarouselConfiguration[] {
  const now = new Date()
  const currentTime = now.toISOString()

  const configurations: CarouselConfiguration[] = [
    // Onboarding Carousel
    {
      id: 'onboarding-flow',
      name: 'Patient Onboarding',
      description: 'Step-by-step introduction for new patients',
      effect: 'slide',
      autoplay: { delay: 8000, disableOnInteraction: false },
      navigation: true,
      pagination: { clickable: true, dynamicBullets: true },
      loop: false,
      slidesPerView: 1,
      spaceBetween: 30,
      centeredSlides: true,
      items: [
        {
          id: 'onboard-1',
          title: 'Welcome to Your Healing Journey',
          description: 'Discover a safe space for growth and recovery',
          content:
            'Begin your personalized therapy experience with our AI-powered platform designed to support your mental health journey.',
          metadata: {
            priority: 1,
            category: 'onboarding',
            tags: ['welcome', 'introduction'],
            publishDate: currentTime,
            targetAudience: ['new-patients'],
          },
        },
        {
          id: 'onboard-2',
          title: 'Your Privacy Comes First',
          description: 'Learn about our enterprise-grade security measures',
          content:
            'We use advanced encryption and privacy-preserving technologies to ensure your personal information remains completely confidential.',
          metadata: {
            priority: 2,
            category: 'onboarding',
            tags: ['privacy', 'security'],
            publishDate: currentTime,
            targetAudience: ['new-patients'],
          },
        },
        {
          id: 'onboard-3',
          title: 'Personalized Treatment Plans',
          description: 'AI-powered therapy tailored to your unique needs',
          content:
            'Our platform creates customized treatment plans based on your goals, preferences, and progress.',
          metadata: {
            priority: 3,
            category: 'onboarding',
            tags: ['personalization', 'treatment'],
            publishDate: currentTime,
            targetAudience: ['new-patients'],
          },
        },
        {
          id: 'onboard-4',
          title: 'Track Your Progress',
          description: 'Visualize your growth with advanced analytics',
          content:
            'Monitor your emotional well-being with our 3D visualization tools and comprehensive progress tracking.',
          metadata: {
            priority: 4,
            category: 'onboarding',
            tags: ['progress', 'analytics'],
            publishDate: currentTime,
            targetAudience: ['new-patients'],
          },
        },
      ],
    },

    // Featured Resources Carousel
    {
      id: 'featured-resources',
      name: 'Featured Therapy Resources',
      description: 'Highlight important tools and techniques',
      effect: 'coverflow',
      autoplay: { delay: 6000 },
      navigation: true,
      pagination: { clickable: true },
      loop: true,
      slidesPerView: 3,
      spaceBetween: 20,
      centeredSlides: true,
      breakpoints: {
        320: { slidesPerView: 1, spaceBetween: 10 },
        640: { slidesPerView: 2, spaceBetween: 15 },
        1024: { slidesPerView: 3, spaceBetween: 20 },
      },
      items: [
        {
          id: 'resource-1',
          title: 'Mindfulness Meditation',
          description: 'Guided meditation sessions for stress relief',
          link: '/techniques/mindfulness',
          metadata: {
            priority: 1,
            category: 'techniques',
            tags: ['mindfulness', 'meditation', 'stress-relief'],
            publishDate: currentTime,
            targetAudience: ['all'],
          },
        },
        {
          id: 'resource-2',
          title: 'Cognitive Behavioral Therapy',
          description: 'Interactive CBT exercises and worksheets',
          link: '/techniques/cbt',
          metadata: {
            priority: 2,
            category: 'techniques',
            tags: ['cbt', 'cognitive', 'behavioral'],
            publishDate: currentTime,
            targetAudience: ['all'],
          },
        },
        {
          id: 'resource-3',
          title: 'Emotion Regulation Skills',
          description: 'Learn to manage difficult emotions effectively',
          link: '/techniques/emotion-regulation',
          metadata: {
            priority: 3,
            category: 'techniques',
            tags: ['emotions', 'regulation', 'skills'],
            publishDate: currentTime,
            targetAudience: ['all'],
          },
        },
        {
          id: 'resource-4',
          title: 'Crisis Support',
          description: '24/7 crisis intervention and support resources',
          link: '/crisis-support',
          metadata: {
            priority: 10,
            category: 'support',
            tags: ['crisis', 'emergency', 'support'],
            publishDate: currentTime,
            targetAudience: ['all'],
          },
        },
      ],
    },

    // Therapist Dashboard Carousel
    {
      id: 'therapist-insights',
      name: 'Therapist Insights',
      description: 'Key insights and updates for therapists',
      effect: 'fade',
      autoplay: { delay: 10000 },
      navigation: false,
      pagination: { clickable: true },
      loop: true,
      slidesPerView: 1,
      spaceBetween: 0,
      centeredSlides: true,
      items: [
        {
          id: 'insight-1',
          title: 'Patient Progress Summary',
          description: 'Weekly overview of patient improvements',
          content:
            'This week: 15% improvement in anxiety scores, 23% increase in session engagement',
          metadata: {
            priority: 1,
            category: 'insights',
            tags: ['progress', 'summary'],
            publishDate: currentTime,
            targetAudience: ['therapists'],
          },
        },
        {
          id: 'insight-2',
          title: 'AI Recommendations',
          description: 'Personalized treatment suggestions',
          content:
            'Recommended interventions based on recent patient interactions and progress patterns',
          metadata: {
            priority: 2,
            category: 'insights',
            tags: ['ai', 'recommendations'],
            publishDate: currentTime,
            targetAudience: ['therapists'],
          },
        },
        {
          id: 'insight-3',
          title: 'Research Updates',
          description: 'Latest findings in digital therapy',
          content:
            'New research shows 40% improvement in outcomes with AI-assisted therapy protocols',
          metadata: {
            priority: 3,
            category: 'insights',
            tags: ['research', 'updates'],
            publishDate: currentTime,
            targetAudience: ['therapists'],
          },
        },
      ],
    },

    // Success Stories Carousel
    {
      id: 'success-stories',
      name: 'Patient Success Stories',
      description: 'Inspiring recovery journeys and testimonials',
      effect: 'slide',
      autoplay: { delay: 7000 },
      navigation: true,
      pagination: { clickable: true, dynamicBullets: true },
      loop: true,
      slidesPerView: 1,
      spaceBetween: 30,
      centeredSlides: false,
      items: [
        {
          id: 'story-1',
          title: 'Overcoming Anxiety',
          description: 'How Sarah reduced her anxiety by 70% in 8 weeks',
          content:
            'Using mindfulness techniques and cognitive restructuring, Sarah successfully managed her panic attacks and returned to normal activities.',
          metadata: {
            priority: 1,
            category: 'testimonials',
            tags: ['anxiety', 'success', 'recovery'],
            publishDate: currentTime,
            targetAudience: ['patients'],
          },
        },
        {
          id: 'story-2',
          title: 'Depression Recovery',
          description: "Michael's journey from isolation to connection",
          content:
            'Through our social skills training and peer support groups, Michael rebuilt his social network and found renewed purpose.',
          metadata: {
            priority: 2,
            category: 'testimonials',
            tags: ['depression', 'social', 'recovery'],
            publishDate: currentTime,
            targetAudience: ['patients'],
          },
        },
        {
          id: 'story-3',
          title: 'PTSD Healing',
          description: "Jessica's path to trauma recovery",
          content:
            'Using EMDR therapy and trauma-informed care, Jessica processed her experiences and reclaimed her sense of safety.',
          metadata: {
            priority: 3,
            category: 'testimonials',
            tags: ['ptsd', 'trauma', 'healing'],
            publishDate: currentTime,
            targetAudience: ['patients'],
          },
        },
      ],
    },
  ]

  // Filter by audience and expiry
  return configurations
    .filter(
      (config) =>
        audience === 'all' ||
        config.items.some(
          (item) =>
            item.metadata?.targetAudience.includes(audience) ||
            item.metadata?.targetAudience.includes('all'),
        ),
    )
    .map((config) => ({
      ...config,
      items: config.items.filter((item) => {
        const isExpired =
          item.metadata?.expiryDate && new Date(item.metadata.expiryDate) < now
        return includeExpired || !isExpired
      }),
    }))
    .filter((config) => config.items.length > 0)
}