import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App.tsx'

// Test de fumée : vérifie seulement que la chaîne de test fonctionne.
describe('App', () => {
  it("affiche le titre de la page d'accueil", () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Night Shift 2026')
  })
})
