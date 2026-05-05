import { useDispatch, useSelector } from 'react-redux'

/**
 * @returns {import('./index').AppDispatch}
 */
export const useAppDispatch = () => useDispatch()

/**
 * @template TSelected
 * @param {(state: import('./index').RootState) => TSelected} selector
 * @returns {TSelected}
 */
export const useAppSelector = (selector) => useSelector(selector)
