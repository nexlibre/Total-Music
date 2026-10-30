import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../src/App'
import { favoritesStore } from '../src/state/favorites'
import { eqStore } from '../src/state/eqStore'
import { playerPrefsStore } from '../src/state/playerPrefs'
import { FAVORITES_KEY } from '../src/state/favorites'
import { EQ_KEY } from '../src/state/eqStore'

const liked = () => screen.getByTestId('liked-count').textContent

beforeEach(() => {
  favoritesStore.reset()
  eqStore.reset()
  playerPrefsStore.reset()
})

async function openEq(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('open-eq'))
  return screen.getByTestId('eq-panel')
}

describe('library + favourites', () => {
  it('starts with an empty favourites list', async () => {
    render(<App />)
    expect(liked()).toBe('0')
    await userEvent.click(screen.getByTestId('tab-liked'))
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    expect(screen.queryByTestId('tracklist')).not.toBeInTheDocument()
  })

  it('adds a track to favourites, updates the badge and persists it', async () => {
    const user = userEvent.setup()
    render(<App />)

    const heart = screen.getByTestId('fav-neon-horizon')
    expect(heart).toHaveAttribute('aria-pressed', 'false')
    expect(heart).toHaveAccessibleName(/Añadir «Neon Horizon»/i)

    await user.click(heart)

    expect(heart).toHaveAttribute('aria-pressed', 'true')
    expect(liked()).toBe('1')
    expect(screen.getByTestId('toast')).toHaveTextContent(/Añadido a Favoritos/i)

    const stored = JSON.parse(localStorage.getItem(FAVORITES_KEY)!)
    expect(stored.ids).toEqual(['neon-horizon'])
  })

  it('removes a favourite when the heart is clicked again', async () => {
    const user = userEvent.setup()
    render(<App />)
    const heart = screen.getByTestId('fav-golden-hour')

    await user.click(heart)
    expect(liked()).toBe('1')

    await user.click(heart)
    expect(liked()).toBe('0')
    expect(heart).toHaveAttribute('aria-pressed', 'false')
    expect(JSON.parse(localStorage.getItem(FAVORITES_KEY)!).ids).toEqual([])
    expect(screen.getByTestId('toast')).toHaveTextContent(/Quitado de Favoritos/i)
  })

  it('lists only favourites in the Favoritos tab, newest first', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByTestId('fav-pulse-reactor'))
    await user.click(screen.getByTestId('fav-soft-landing'))
    expect(liked()).toBe('2')

    await user.click(screen.getByTestId('tab-liked'))

    const list = screen.getByTestId('tracklist')
    const rows = within(list).getAllByRole('button').filter((el) => el.className.includes('trackrow'))
    expect(rows).toHaveLength(2)
    expect(within(list).getByText('Pulse Reactor')).toBeInTheDocument()
    expect(within(list).getByText('Soft Landing')).toBeInTheDocument()
    expect(within(list).queryByText('Neon Horizon')).not.toBeInTheDocument()
    expect(screen.getByTestId('library-meta')).toHaveTextContent(/2 pistas/i)
  })

  it('shows the empty state again after unliking from the Liked tab', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByTestId('fav-neon-horizon'))
    await user.click(screen.getByTestId('tab-liked'))
    expect(screen.getByTestId('tracklist')).toBeInTheDocument()

    await user.click(screen.getByTestId('fav-neon-horizon'))
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    expect(screen.getByText(/Todavía no hay favoritos/i)).toBeInTheDocument()
  })

  it('keeps the same favourite state from the player bar heart', async () => {
    const user = userEvent.setup()
    render(<App />)

    // start playback so the bar shows a track
    await user.click(screen.getByTestId('row-midnight-drive'))
    await waitFor(() => expect(screen.getByTestId('play-toggle')).toHaveAccessibleName('Pausar'))

    const hearts = screen.getAllByTestId('fav-midnight-drive')
    expect(hearts.length).toBeGreaterThanOrEqual(2) // row + player bar
    await user.click(hearts[hearts.length - 1])
    expect(liked()).toBe('1')

    // every heart for that track reflects the same store
    for (const heart of screen.getAllByTestId('fav-midnight-drive')) {
      expect(heart).toHaveAttribute('aria-pressed', 'true')
    }
  })

  it('filters the library with the search box', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByTestId('search'), 'golden')
    expect(screen.getByTestId('row-golden-hour')).toBeInTheDocument()
    expect(screen.queryByTestId('row-neon-horizon')).not.toBeInTheDocument()

    await user.clear(screen.getByTestId('search'))
    await user.type(screen.getByTestId('search'), 'zzz')
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
  })

  it('restores favourites from localStorage on a fresh load', async () => {
    vi.resetModules()
    localStorage.setItem(FAVORITES_KEY, JSON.stringify({ ids: ['golden-hour', 'iron-bloom'] }))

    const { default: FreshApp } = await import('../src/App')
    render(<FreshApp />)

    expect(screen.getByTestId('liked-count')).toHaveTextContent('2')
    expect(screen.getByTestId('fav-golden-hour')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('fav-neon-horizon')).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('equalizer', () => {
  it('opens from the player bar and starts in bypass', async () => {
    const user = userEvent.setup()
    render(<App />)
    const panel = await openEq(user)

    const toggle = within(panel).getByTestId('eq-toggle')
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(within(panel).getByTestId('band-1000')).toHaveAttribute('aria-disabled', 'true')
    expect(within(panel).getByTestId('eq-curve')).toBeInTheDocument()
  })

  it('enables the EQ and applies a preset to every band', async () => {
    const user = userEvent.setup()
    render(<App />)
    const panel = await openEq(user)

    await user.click(within(panel).getByTestId('eq-toggle'))
    expect(within(panel).getByTestId('eq-toggle')).toHaveAttribute('aria-checked', 'true')
    expect(within(panel).getByTestId('band-1000')).toHaveAttribute('aria-disabled', 'false')

    await user.click(within(panel).getByTestId('preset-rock'))
    expect(within(panel).getByTestId('band-31')).toHaveAttribute('aria-valuenow', '5')
    expect(within(panel).getByTestId('band-1000')).toHaveAttribute('aria-valuenow', '-1.5')
    expect(within(panel).getByTestId('band-16000')).toHaveAttribute('aria-valuenow', '4')

    const stored = JSON.parse(localStorage.getItem(EQ_KEY)!)
    expect(stored.presetId).toBe('rock')
    expect(stored.enabled).toBe(true)
    expect(stored.gains).toEqual([5, 4.5, 3, 1, -1, -1.5, 0.5, 2.5, 3.5, 4])
  })

  it('adjusts a band with the keyboard and marks the curve as custom', async () => {
    const user = userEvent.setup()
    render(<App />)
    const panel = await openEq(user)

    await user.click(within(panel).getByTestId('eq-toggle'))
    await user.click(within(panel).getByTestId('preset-flat'))

    const band = within(panel).getByTestId('band-2000')
    act(() => band.focus())
    fireEvent.keyDown(band, { key: 'ArrowUp' })
    expect(band).toHaveAttribute('aria-valuenow', '1')
    expect(within(panel).getByText('Personalizado')).toBeInTheDocument()

    fireEvent.keyDown(band, { key: 'ArrowUp' })
    expect(band).toHaveAttribute('aria-valuenow', '2')
    fireEvent.keyDown(band, { key: 'ArrowDown' })
    expect(band).toHaveAttribute('aria-valuenow', '1')

    // "0" resets the focused band
    fireEvent.keyDown(band, { key: '0' })
    expect(band).toHaveAttribute('aria-valuenow', '0')

    // ← keyboard control is reflected in storage
    fireEvent.keyDown(band, { key: 'End' })
    expect(band).toHaveAttribute('aria-valuenow', '12')
    expect(JSON.parse(localStorage.getItem(EQ_KEY)!).gains[6]).toBe(12)
  })

  it('clamps with End/Home and double click resets a band', async () => {
    const user = userEvent.setup()
    render(<App />)
    const panel = await openEq(user)
    await user.click(within(panel).getByTestId('eq-toggle'))

    const band = within(panel).getByTestId('band-4000')
    act(() => band.focus())
    fireEvent.keyDown(band, { key: 'End' })
    expect(band).toHaveAttribute('aria-valuenow', '12')
    fireEvent.doubleClick(band)
    expect(band).toHaveAttribute('aria-valuenow', '0')
  })

  it('flattens everything with the reset button', async () => {
    const user = userEvent.setup()
    render(<App />)
    const panel = await openEq(user)

    await user.click(within(panel).getByTestId('eq-toggle'))
    await user.click(within(panel).getByTestId('preset-bass'))
    expect(within(panel).getByTestId('band-31')).toHaveAttribute('aria-valuenow', '9')

    await user.click(within(panel).getByTestId('eq-reset'))
    expect(within(panel).getByTestId('band-31')).toHaveAttribute('aria-valuenow', '0')
    expect(within(panel).getByTestId('preamp')).toHaveValue('0')
    expect(within(panel).queryByText('Personalizado')).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(EQ_KEY)!).presetId).toBe('flat')
  })

  it('moves the preamp and reports headroom honestly', async () => {
    const user = userEvent.setup()
    render(<App />)
    const panel = await openEq(user)

    await user.click(within(panel).getByTestId('eq-toggle'))
    await user.click(within(panel).getByTestId('preset-bass'))

    // bass preset boosts the low end: a positive peak must be reported
    const headroom = within(panel).getByTestId('headroom')
    expect(headroom).toHaveTextContent(/Pico de \+/i)

    await user.click(within(panel).getByRole('button', { name: /auto-headroom/i }))
    // the bass preset sums +26 dB of boost -> clamped to the -12 dB preamp floor
    expect(within(panel).getByTestId('preamp')).toHaveValue('-12')
    expect(within(panel).getByTestId('headroom')).toHaveTextContent(/Headroom OK/i)
  })

  it('toggles the limiter and persists it', async () => {
    const user = userEvent.setup()
    render(<App />)
    const panel = await openEq(user)

    const limiter = within(panel).getByTestId('limiter-toggle')
    expect(limiter).toHaveAttribute('aria-checked', 'true')
    await user.click(limiter)
    expect(limiter).toHaveAttribute('aria-checked', 'false')
    expect(JSON.parse(localStorage.getItem(EQ_KEY)!).limiter).toBe(false)
  })

  it('closes with Escape and with the close button', async () => {
    const user = userEvent.setup()
    render(<App />)
    let panel = await openEq(user)
    expect(panel).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('eq-panel')).not.toBeInTheDocument())

    panel = await openEq(user)
    await user.click(within(panel).getByTestId('eq-close'))
    await waitFor(() => expect(screen.queryByTestId('eq-panel')).not.toBeInTheDocument())
  })

  it('survives a corrupted stored EQ without crashing', async () => {
    vi.resetModules()
    localStorage.setItem(EQ_KEY, JSON.stringify({ enabled: 'yes', gains: 'nope', preamp: 999 }))

    const { default: FreshApp } = await import('../src/App')
    render(<FreshApp />)
    const user = userEvent.setup()
    const panel = await openEq(user)

    expect(within(panel).getByTestId('eq-toggle')).toHaveAttribute('aria-checked', 'false')
    expect(within(panel).getByTestId('preamp')).toHaveValue('12')
    expect(within(panel).getAllByRole('slider').length).toBeGreaterThanOrEqual(10)
  })
})

describe('playback transport', () => {
  it('plays, pauses and advances with the transport buttons', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByTestId('row-neon-horizon'))
    await waitFor(() => expect(screen.getByTestId('play-toggle')).toHaveAccessibleName('Pausar'))

    // progress bar reflects a duration
    expect(screen.getByTestId('scrubber')).toHaveAttribute('aria-valuemax', expect.any(String))

    await user.click(screen.getByTestId('play-toggle'))
    await waitFor(() => expect(screen.getByTestId('play-toggle')).toHaveAccessibleName('Reproducir'))

    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    const bar = screen.getByRole('region', { name: 'Reproductor' })
    await waitFor(() => expect(within(bar).getByText('Midnight Drive')).toBeInTheDocument())
  })

  it('opens the now-playing screen with the current track', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByTestId('row-golden-hour'))
    await user.click(screen.getByRole('button', { name: /Abrir «Golden Hour»/i }))

    const now = screen.getByTestId('now-playing')
    expect(within(now).getByRole('heading', { name: 'Golden Hour' })).toBeInTheDocument()
    expect(within(now).getByTestId('visualizer')).toBeInTheDocument()
    expect(within(now).getByTestId('fav-golden-hour')).toHaveAttribute('aria-pressed', 'false')
  })
})
