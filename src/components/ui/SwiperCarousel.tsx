import React, { useRef, useEffect, useState, useMemo } from 'react'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation, Pagination, Autoplay, EffectFade, EffectCoverflow, Keyboard, Mousewheel, A11y } from 'swiper/modules'
import type { Swiper as SwiperType } from 'swiper'

// Import Swiper styles
import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'
import 'swiper/css/effect-fade'
import 'swiper/css/effect-coverflow'

interface CarouselItem {
  id: string
  content?: React.ReactNode
  title?: string
  description?: string
  image?: string
  link?: string
  icon?: string
  gradient?: string
  subtitle?: string
}

interface SwiperCarouselProps {
  items?: CarouselItem[]
  effect?: 'slide' | 'fade' | 'coverflow' | 'flip' | 'cube'
  autoplay?: boolean | { delay: number; disableOnInteraction?: boolean }
  navigation?: boolean
  pagination?: boolean | { clickable?: boolean; dynamicBullets?: boolean }
  loop?: boolean
  slidesPerView?: number | 'auto'
  spaceBetween?: number
  centeredSlides?: boolean
  grabCursor?: boolean
  keyboard?: boolean
  mousewheel?: boolean
  className?: string
  height?: string
  breakpoints?: Record<number, unknown>
  onSlideChange?: (swiper: SwiperType) => void
  onSwiper?: (swiper: SwiperType) => void
}

const SwiperCarousel: React.FC<SwiperCarouselProps> = ({
  items,
  effect = 'slide',
  autoplay = false,
  navigation = true,
  pagination = { clickable: true, dynamicBullets: true },
  loop = true,
  slidesPerView = 1,
  spaceBetween = 30,
  centeredSlides = true,
  grabCursor = true,
  keyboard = true,
  mousewheel = false,
  className = '',
  height = '400px',
  breakpoints,
  onSlideChange,
  onSwiper,
}) => {
  const [carouselItems, setCarouselItems] = useState<CarouselItem[]>([])
  const [isReady, setIsReady] = useState(false)
  const swiperRef = useRef<SwiperType>()

  // Default demo content - memoized to prevent recreation
  const defaultItems: CarouselItem[] = useMemo(() => [
    {
      id: '1',
      title: 'Therapeutic Journey',
      description: 'Explore your emotional landscape with guided sessions',
      content: (
        <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-blue-500 to-purple-600 text-white p-8 rounded-lg">
          <div className="text-6xl mb-4">🧠</div>
          <h3 className="text-2xl font-bold mb-2">Mindfulness</h3>
          <p className="text-center opacity-90">Begin your healing journey with mindful awareness</p>
        </div>
      ),
    },
    {
      id: '2',
      title: 'Progress Tracking',
      description: 'Monitor your emotional growth over time',
      content: (
        <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-green-500 to-teal-600 text-white p-8 rounded-lg">
          <div className="text-6xl mb-4">📈</div>
          <h3 className="text-2xl font-bold mb-2">Analytics</h3>
          <p className="text-center opacity-90">Track your progress with detailed insights</p>
        </div>
      ),
    },
    {
      id: '3',
      title: 'Community Support',
      description: 'Connect with others on similar journeys',
      content: (
        <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-pink-500 to-rose-600 text-white p-8 rounded-lg">
          <div className="text-6xl mb-4">🤝</div>
          <h3 className="text-2xl font-bold mb-2">Community</h3>
          <p className="text-center opacity-90">Find support in our caring community</p>
        </div>
      ),
    },
    {
      id: '4',
      title: 'Personalized Tools',
      description: 'AI-powered tools tailored to your needs',
      content: (
        <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-orange-500 to-red-600 text-white p-8 rounded-lg">
          <div className="text-6xl mb-4">🎯</div>
          <h3 className="text-2xl font-bold mb-2">AI Tools</h3>
          <p className="text-center opacity-90">Personalized interventions powered by AI</p>
        </div>
      ),
    },
    {
      id: '5',
      title: 'Secure & Private',
      description: 'Your data is protected with enterprise-grade security',
      content: (
        <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-indigo-500 to-blue-600 text-white p-8 rounded-lg">
          <div className="text-6xl mb-4">🔒</div>
          <h3 className="text-2xl font-bold mb-2">Security</h3>
          <p className="text-center opacity-90">Your privacy is our top priority</p>
        </div>
      ),
    },
  ], [])

  // Default responsive breakpoints
  const defaultBreakpoints = {
    320: {
      slidesPerView: 1,
      spaceBetween: 10,
    },
    640: {
      slidesPerView: slidesPerView === 'auto' ? 'auto' : Math.min(2, typeof slidesPerView === 'number' ? slidesPerView : 1),
      spaceBetween: 20,
    },
    1024: {
      slidesPerView: slidesPerView === 'auto' ? 'auto' : Math.min(3, typeof slidesPerView === 'number' ? slidesPerView : 1),
      spaceBetween: 30,
    },
  }

  useEffect(() => {
    setCarouselItems(items || defaultItems)
    setIsReady(true)
  }, [items, defaultItems])

  const modules = [
    Navigation,
    Pagination,
    A11y,
    ...(autoplay ? [Autoplay] : []),
    ...(keyboard ? [Keyboard] : []),
    ...(mousewheel ? [Mousewheel] : []),
    ...(effect === 'fade' ? [EffectFade] : []),
    ...(effect === 'coverflow' ? [EffectCoverflow] : []),
  ]

  const swiperProps = {
    modules,
    effect,
    spaceBetween,
    slidesPerView,
    centeredSlides,
    loop: loop && carouselItems.length > 1,
    grabCursor,
    navigation: navigation ? {
      nextEl: '.swiper-button-next',
      prevEl: '.swiper-button-prev',
    } : false,
    pagination: pagination ? {
      clickable: typeof pagination === 'object' ? pagination.clickable : true,
      dynamicBullets: typeof pagination === 'object' ? pagination.dynamicBullets : true,
    } : false,
    autoplay: autoplay ? (typeof autoplay === 'object' ? autoplay : { delay: 3000 }) : false,
    keyboard: keyboard ? {
      enabled: true,
      onlyInViewport: true,
    } : false,
    mousewheel: mousewheel ? {
      forceToAxis: true,
    } : false,
    breakpoints: breakpoints || defaultBreakpoints,
    onSwiper: (swiper: SwiperType) => {
      swiperRef.current = swiper
      onSwiper?.(swiper)
    },
    onSlideChange,
    // Effect-specific props
    ...(effect === 'coverflow' && {
      coverflowEffect: {
        rotate: 50,
        stretch: 0,
        depth: 100,
        modifier: 1,
        slideShadows: true,
      },
    }),
    ...(effect === 'fade' && {
      fadeEffect: {
        crossFade: true,
      },
    }),
  }

  if (!isReady) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 rounded-lg ${className}`} style={{ height }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-600">Loading carousel...</span>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`} style={{ height }}>
      <Swiper {...swiperProps} className="w-full h-full">
        {carouselItems.map((item) => (
          <SwiperSlide key={item.id} className="flex items-center justify-center">
            {item.content ? (
              typeof item.content === 'string' ? (
                <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                  {item.image && (
                    <img 
                      src={item.image} 
                      alt={item.title || 'Carousel item'} 
                      className="w-full h-48 object-cover rounded-lg mb-4"
                    />
                  )}
                  {item.title && <h3 className="text-xl font-bold mb-2">{item.title}</h3>}
                  {item.description && <p className="text-gray-600 mb-4">{item.description}</p>}
                  <div className="text-lg">{item.content}</div>
                  {item.link && (
                    <a 
                      href={item.link} 
                      className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                    >
                      Learn More
                    </a>
                  )}
                </div>
              ) : (
                item.content
              )
            ) : (
              <div className={`flex flex-col items-center justify-center h-full bg-gradient-to-br ${item.gradient || 'from-gray-500 to-gray-600'} text-white p-6 rounded-lg`}>
                {item.icon && <div className="text-5xl mb-4">{item.icon}</div>}
                {item.title && <h3 className="text-xl font-bold mb-2">{item.title}</h3>}
                {item.subtitle && <p className="text-center text-sm opacity-90">{item.subtitle}</p>}
              </div>
            )}
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Custom Navigation Buttons */}
      {navigation && (
        <>
          <div className="swiper-button-prev !text-white !bg-black !bg-opacity-50 !rounded-full !w-10 !h-10 !mt-0 !top-1/2 !left-4 hover:!bg-opacity-70 transition-all duration-200"></div>
          <div className="swiper-button-next !text-white !bg-black !bg-opacity-50 !rounded-full !w-10 !h-10 !mt-0 !top-1/2 !right-4 hover:!bg-opacity-70 transition-all duration-200"></div>
        </>
      )}

      {/* Accessibility announcements */}
      <div className="sr-only" aria-live="polite" id="carousel-status">
        Carousel with {carouselItems.length} items
      </div>
    </div>
  )
}

export default SwiperCarousel
