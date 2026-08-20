import { createContext, useContext } from 'react'

// Carries the guided-tour controls so any page (the Dashboard "Take a tour"
// button today) can start the tour while the engine's state lives in a single
// provider mounted above the router outlet in Layout — so it survives the
// route changes the tour itself makes. Kept in its own module (like
// page-action-context.js) so the provider file can export only components and
// stay Fast-Refresh friendly.
export const TourContext = createContext(null)

// A no-op shape for callers rendered outside the provider (e.g. pages shown
// without Layout), so a "Take a tour" control can render without crashing.
const NOOP_TOUR = {
	isActive: false,
	stepIndex: 0,
	hasCompleted: false,
	startTour: () => {},
	endTour: () => {},
}

export function useTour() {
	return useContext(TourContext) ?? NOOP_TOUR
}
