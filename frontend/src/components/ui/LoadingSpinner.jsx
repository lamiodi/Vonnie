import React from 'react'
import { cn } from '../../lib/utils'

const LoadingSpinner = ({ 
  size = 'md', 
  color = 'primary', 
  className = '',
  text = '',
  fullScreen = false,
  overlay = false
}) => {
  // Size variants
  const sizeClasses = {
    xs: 'w-4 h-4',
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  }

  // Color variants
  const colorClasses = {
    primary: 'text-primary-600',
    secondary: 'text-secondary-600',
    white: 'text-white',
    gray: 'text-gray-600',
    success: 'text-green-600',
    warning: 'text-yellow-600',
    error: 'text-red-600',
  }

  // Text size based on spinner size
  const textSizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
  }

  const spinnerElement = (
    <div className={cn('flex flex-col items-center justify-center', className)}>
      {/* Spinner */}
      <div className="relative">
        <div
          className={cn(
            'animate-spin rounded-full border-2 border-current border-t-transparent',
            sizeClasses[size],
            colorClasses[color]
          )}
        >
          <span className="sr-only">Loading...</span>
        </div>
      </div>
      
      {/* Loading text */}
      {text && (
        <p className={cn(
          'mt-3 font-medium',
          textSizeClasses[size],
          colorClasses[color]
        )}>
          {text}
        </p>
      )}
    </div>
  )

  // Full screen loading
  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        {spinnerElement}
      </div>
    )
  }

  // Overlay loading
  if (overlay) {
    return (
      <div className="absolute inset-0 z-40 flex items-center justify-center bg-white/80 backdrop-blur-sm">
        {spinnerElement}
      </div>
    )
  }

  return spinnerElement
}

// Specialized spinner variants
export const ButtonSpinner = ({ size = 'sm', className = '' }) => (
  <LoadingSpinner 
    size={size} 
    color="white" 
    className={cn('inline-flex', className)}
  />
)

export const PageSpinner = ({ text = 'Loading...', className = '' }) => (
  <div className={cn('min-h-[400px] flex items-center justify-center', className)}>
    <LoadingSpinner 
      size="lg" 
      color="primary" 
      text={text}
    />
  </div>
)

export const CardSpinner = ({ text = '', className = '' }) => (
  <div className={cn('p-8 flex items-center justify-center', className)}>
    <LoadingSpinner 
      size="md" 
      color="primary" 
      text={text}
    />
  </div>
)

export const InlineSpinner = ({ size = 'sm', className = '' }) => (
  <LoadingSpinner 
    size={size} 
    color="primary" 
    className={cn('inline-flex', className)}
  />
)

// Skeleton loading components
export const SkeletonLine = ({ className = '', width = 'full' }) => {
  const widthClasses = {
    full: 'w-full',
    '3/4': 'w-3/4',
    '1/2': 'w-1/2',
    '1/3': 'w-1/3',
    '1/4': 'w-1/4',
  }

  return (
    <div 
      className={cn(
        'h-4 bg-gray-200 rounded animate-pulse',
        widthClasses[width],
        className
      )}
    />
  )
}

export const SkeletonCard = ({ className = '' }) => (
  <div className={cn('p-6 bg-white rounded-lg border border-gray-200', className)}>
    <div className="animate-pulse">
      <div className="flex items-center space-x-4 mb-4">
        <div className="w-12 h-12 bg-gray-200 rounded-full" />
        <div className="flex-1 space-y-2">
          <SkeletonLine width="3/4" />
          <SkeletonLine width="1/2" />
        </div>
      </div>
      <div className="space-y-3">
        <SkeletonLine />
        <SkeletonLine width="3/4" />
        <SkeletonLine width="1/2" />
      </div>
    </div>
  </div>
)

export const SkeletonTable = ({ rows = 5, columns = 4, className = '' }) => (
  <div className={cn('bg-white rounded-lg border border-gray-200 overflow-hidden', className)}>
    <div className="animate-pulse">
      {/* Table header */}
      <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
        <div className="flex space-x-4">
          {Array.from({ length: columns }).map((_, index) => (
            <div key={index} className="flex-1">
              <SkeletonLine className="h-3" width={index === 0 ? 'full' : '3/4'} />
            </div>
          ))}
        </div>
      </div>
      
      {/* Table rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="px-6 py-4 border-b border-gray-200 last:border-b-0">
          <div className="flex space-x-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div key={colIndex} className="flex-1">
                <SkeletonLine 
                  className="h-3" 
                  width={colIndex === 0 ? 'full' : Math.random() > 0.5 ? '3/4' : '1/2'} 
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
)

// Loading states for specific components
export const DashboardSkeleton = () => (
  <div className="space-y-6">
    {/* Stats cards */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="animate-pulse">
            <div className="flex items-center justify-between mb-4">
              <div className="w-8 h-8 bg-gray-200 rounded" />
              <div className="w-16 h-4 bg-gray-200 rounded" />
            </div>
            <div className="w-20 h-8 bg-gray-200 rounded mb-2" />
            <div className="w-24 h-3 bg-gray-200 rounded" />
          </div>
        </div>
      ))}
    </div>
    
    {/* Charts */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="animate-pulse">
          <div className="w-32 h-6 bg-gray-200 rounded mb-4" />
          <div className="w-full h-64 bg-gray-200 rounded" />
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="animate-pulse">
          <div className="w-32 h-6 bg-gray-200 rounded mb-4" />
          <div className="w-full h-64 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  </div>
)

// Named and default exports
export { LoadingSpinner }
export default LoadingSpinner