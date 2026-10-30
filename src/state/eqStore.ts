import { createStore, type ReadableStore } from './store'
import { DEFAULT_EQ, parseEqState, type EqState } from '../audio/eq'

export const EQ_KEY = 'tm.eq.v1'

export const eqStore: ReadableStore<EqState> = createStore<EqState>(EQ_KEY, DEFAULT_EQ, parseEqState)

export const setEq = (updater: EqState | ((prev: EqState) => EqState)) => eqStore.set(updater)
