'use client'

/**
 * HTTPAccessFallbackBoundary is a boundary that catches errors and renders a
 * fallback component for HTTP errors.
 *
 * It receives the status code, and determine if it should render fallbacks for few HTTP 4xx errors.
 *
 * e.g. 404
 * 404 represents not found, and the fallback component pair contains the component and its styles.
 *
 * TODO: support 401 and 403 HTTP errors.
 */

import React, { useContext } from 'react'
import { useUntrackedPathname } from '../navigation-untracked'
import {
  getAccessFallbackHTTPStatus,
  isHTTPAccessFallbackError,
} from './http-access-fallback'
import { warnOnce } from '../../../shared/lib/utils/warn-once'
import { MissingSlotContext } from '../../../shared/lib/app-router-context.shared-runtime'

const HTTPErrorStatus = {
  NOT_FOUND: 404,
  // TODO: support 401 and 403 HTTP errors.
} as const

interface HTTPAccessFallbackBoundaryProps {
  notFound?: React.ReactNode
  children: React.ReactNode
  missingSlots?: Set<string>
}

interface HTTPAccessFallbackErrorBoundaryProps
  extends HTTPAccessFallbackBoundaryProps {
  pathname: string | null
  missingSlots?: Set<string>
}

interface HTTPAccessBoundaryState {
  triggeredStatus: number | undefined
  previousPathname: string | null
}

class HTTPAccessFallbackErrorBoundary extends React.Component<
  HTTPAccessFallbackErrorBoundaryProps,
  HTTPAccessBoundaryState
> {
  constructor(props: HTTPAccessFallbackErrorBoundaryProps) {
    super(props)
    this.state = {
      triggeredStatus: undefined,
      previousPathname: props.pathname,
    }
  }

  componentDidCatch(): void {
    if (
      process.env.NODE_ENV === 'development' &&
      this.props.missingSlots &&
      // A missing children slot is the typical not-found case, so no need to warn
      !this.props.missingSlots.has('children')
    ) {
      let warningMessage =
        'No default component was found for a parallel route rendered on this page. Falling back to nearest NotFound boundary.\n' +
        'Learn more: https://nextjs.org/docs/app/building-your-application/routing/parallel-routes#defaultjs\n\n'

      if (this.props.missingSlots.size > 0) {
        const formattedSlots = Array.from(this.props.missingSlots)
          .sort((a, b) => a.localeCompare(b))
          .map((slot) => `@${slot}`)
          .join(', ')

        warningMessage += 'Missing slots: ' + formattedSlots
      }

      warnOnce(warningMessage)
    }
  }

  static getDerivedStateFromError(error: any) {
    if (isHTTPAccessFallbackError(error)) {
      return {
        triggeredStatus: getAccessFallbackHTTPStatus(error),
      }
    }
    // Re-throw if error is not for 404
    throw error
  }

  static getDerivedStateFromProps(
    props: HTTPAccessFallbackErrorBoundaryProps,
    state: HTTPAccessBoundaryState
  ): HTTPAccessBoundaryState | null {
    /**
     * Handles reset of the error boundary when a navigation happens.
     * Ensures the error boundary does not stay enabled when navigating to a new page.
     * Approach of setState in render is safe as it checks the previous pathname and then overrides
     * it as outlined in https://react.dev/reference/react/useState#storing-information-from-previous-renders
     */
    if (props.pathname !== state.previousPathname && state.triggeredStatus) {
      return {
        triggeredStatus: undefined,
        previousPathname: props.pathname,
      }
    }
    return {
      triggeredStatus: state.triggeredStatus,
      previousPathname: props.pathname,
    }
  }

  render() {
    const { notFound } = this.props
    if (this.state.triggeredStatus === HTTPErrorStatus.NOT_FOUND) {
      return (
        <>
          <meta name="robots" content="noindex" />
          {process.env.NODE_ENV === 'development' && (
            <meta name="next-error" content="not-found" />
          )}
          {notFound}
        </>
      )
    }

    return this.props.children
  }
}

export function HTTPAccessFallbackBoundary({
  notFound,
  children,
}: HTTPAccessFallbackBoundaryProps) {
  // When we're rendering the missing params shell, this will return null. This
  // is because we won't be rendering any not found boundaries or error
  // boundaries for the missing params shell. When this runs on the client
  // (where these error can occur), we will get the correct pathname.
  const pathname = useUntrackedPathname()
  const missingSlots = useContext(MissingSlotContext)

  if (notFound) {
    return (
      <HTTPAccessFallbackErrorBoundary
        pathname={pathname}
        notFound={notFound}
        missingSlots={missingSlots}
      >
        {children}
      </HTTPAccessFallbackErrorBoundary>
    )
  }

  return <>{children}</>
}
