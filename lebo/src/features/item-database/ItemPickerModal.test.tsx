import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { ItemPickerModal } from './ItemPickerModal'
import type { ItemDatabase } from '../../shared/types/itemDatabase'

// Real-shaped fixture: carries levelRequirement + implicit/affix display text (the 4.1.5 fields the
// modal filters and shows). Slots mirror the shipped 3-convention wrinkle — base/unique helms use
// `helm`, the set helm uses `helmet` — so a helmet-scoped modal must surface all three via slotMap.
const db: ItemDatabase = {
  baseItems: [
    {
      id: 'jewelled-circlet', name: 'Jewelled Circlet', baseType: 'Circlet', slot: 'helm',
      implicitAffixIds: [], levelRequirement: 7,
      implicits: [{ text: '(5-25)% increased Spell Damage' }, { text: '+(10-35) Mana' }],
    },
    {
      id: 'iron-casque', name: 'Iron Casque', baseType: 'Plate Helm', slot: 'helm',
      implicitAffixIds: [], levelRequirement: 10, implicits: [{ text: '+14 Armor' }],
    },
    {
      id: 'refuge-helmet', name: 'Refuge Helmet', baseType: 'Helmet', slot: 'helm',
      implicitAffixIds: [], levelRequirement: 0, implicits: [],
    },
    {
      id: 'iron-sword', name: 'Iron Sword', baseType: 'Sword', slot: 'weapon',
      implicitAffixIds: [], levelRequirement: 2, implicits: [],
    },
  ],
  uniqueItems: [
    {
      id: 'calamity', name: 'Calamity', baseType: 'Circlet', slot: 'helm', levelRequirement: 44,
      affixes: [
        { affixId: 'c0', fixedMinValue: 20, fixedMaxValue: 80, text: '(20-80)% increased Fire Damage' },
        { affixId: 'c1', fixedMinValue: 100, fixedMaxValue: 150, text: '+(100-150)% Chance to Ignite' },
      ],
    },
  ],
  affixes: [],
  setItems: [
    {
      id: 'forgotten-helm', name: 'Vestments of the Forgotten', baseType: 'Helmet', slot: 'helmet',
      setName: 'Forgotten', description: 'A set helm.',
      affixes: [{ affixId: 'f0', fixedMinValue: 1, fixedMaxValue: 1, text: '+1 to All Attributes' }],
      setBonuses: [{ piecesRequired: 2, description: '20% increased Attack Speed' }],
    },
  ],
}

function renderModal(overrides?: Partial<Parameters<typeof ItemPickerModal>[0]>) {
  const onEquip = vi.fn()
  const onClose = vi.fn()
  render(
    <ItemPickerModal
      slotId="helmet"
      slotName="Helmet"
      itemDatabase={db}
      onEquip={onEquip}
      onClose={onClose}
      {...overrides}
    />,
  )
  return { onEquip, onClose }
}

describe('ItemPickerModal', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('renders slot-scoped items with real name + base type; excludes wrong-slot items', () => {
    renderModal()
    // helm (base/unique) + helmet (set) all surface for the helmet gear slot
    expect(screen.getByText('Jewelled Circlet')).toBeInTheDocument()
    expect(screen.getByText('Calamity')).toBeInTheDocument()
    expect(screen.getByText('Vestments of the Forgotten')).toBeInTheDocument()
    // real base type rendered on the card (also appears as an Item Type option — assert the card)
    expect(screen.getByRole('gridcell', { name: 'Iron Casque, Plate Helm' })).toBeInTheDocument()
    // wrong-slot item is excluded (Iron Sword is a weapon)
    expect(screen.queryByText('Iron Sword')).toBeNull()
  })

  it('shows the affix slot count for bases and the stat-line fallback for uniques', () => {
    renderModal()
    // base card: rule-constant affix slot count
    expect(screen.getAllByText('4 affix slots').length).toBeGreaterThan(0)
    // unique card: real affix stat line (flavor fallback), not an empty flavor block
    expect(screen.getByText('(20-80)% increased Fire Damage')).toBeInTheDocument()
  })

  it('set cards show real set data, never a fabricated "N affix slots" count', async () => {
    renderModal()
    await userEvent.click(screen.getByRole('button', { name: 'Set' }))
    expect(screen.getByText('Vestments of the Forgotten')).toBeInTheDocument()
    // a fixed set item must NOT advertise craftable affix slots (the #1 failure mode)
    expect(screen.queryByText(/affix slots/)).toBeNull()
    // its real data surfaces instead (affix text / set bonus)
    expect(screen.getByText('+1 to All Attributes')).toBeInTheDocument()
  })

  it('Rarity=Unique hides bases and sets (collection filter)', async () => {
    renderModal()
    await userEvent.click(screen.getByRole('button', { name: 'Unique' }))
    expect(screen.getByText('Calamity')).toBeInTheDocument()
    expect(screen.queryByText('Jewelled Circlet')).toBeNull()
    expect(screen.queryByText('Vestments of the Forgotten')).toBeNull()
  })

  it('Item Type filter narrows by the real base type', async () => {
    renderModal()
    await userEvent.selectOptions(screen.getByLabelText('Item Type'), 'Circlet')
    // Circlet-based items only (base Jewelled Circlet + unique Calamity)
    expect(screen.getByText('Jewelled Circlet')).toBeInTheDocument()
    expect(screen.getByText('Calamity')).toBeInTheDocument()
    // Plate Helm / Helmet base types are hidden
    expect(screen.queryByText('Iron Casque')).toBeNull()
    expect(screen.queryByText('Refuge Helmet')).toBeNull()
  })

  it('Item Level slider narrows by the real levelRequirement (low shows, high hides)', () => {
    renderModal()
    const slider = screen.getByRole('slider', { name: 'Maximum item level' })
    fireEvent.change(slider, { target: { value: '9' } })
    expect(screen.getByText('Jewelled Circlet')).toBeInTheDocument() // lvl 7 ≤ 9
    expect(screen.queryByText('Iron Casque')).toBeNull() // lvl 10 > 9
    expect(screen.queryByText('Calamity')).toBeNull() // lvl 44 > 9
  })

  it('real-time search narrows the grid', async () => {
    renderModal()
    await userEvent.type(screen.getByLabelText('Search items'), 'Calam')
    expect(screen.getByText('Calamity')).toBeInTheDocument()
    expect(screen.queryByText('Jewelled Circlet')).toBeNull()
  })

  it('single-click selects and the Equip Item button reports the exact item', async () => {
    const { onEquip } = renderModal()
    await userEvent.click(screen.getByRole('gridcell', { name: 'Calamity, Circlet' }))
    const equipBtn = screen.getByRole('button', { name: 'Equip Item' })
    expect(equipBtn).toBeEnabled()
    await userEvent.click(equipBtn)
    expect(onEquip).toHaveBeenCalledTimes(1)
    expect(onEquip).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'calamity', name: 'Calamity', baseType: 'Circlet', slot: 'helm', type: 'unique' }),
    )
  })

  it('Equip Item button is disabled until an item is selected', () => {
    renderModal()
    expect(screen.getByRole('button', { name: 'Equip Item' })).toBeDisabled()
  })

  it('double-click equips immediately', async () => {
    const { onEquip } = renderModal()
    await userEvent.dblClick(screen.getByRole('gridcell', { name: 'Jewelled Circlet, Circlet' }))
    expect(onEquip).toHaveBeenCalledWith(expect.objectContaining({ id: 'jewelled-circlet', type: 'base' }))
  })

  it('hovering a card shows a tooltip with the real implicit stat text', async () => {
    renderModal()
    const card = screen.getByRole('gridcell', { name: 'Jewelled Circlet, Circlet' })
    await userEvent.hover(card)
    await waitFor(() => {
      const tip = screen.getByRole('tooltip')
      expect(tip).toHaveTextContent('(5-25)% increased Spell Damage')
      expect(tip).toHaveTextContent('+(10-35) Mana')
    })
  })

  it('Escape closes the modal (Headless UI Dialog)', async () => {
    const { onClose } = renderModal()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  it('renders "Database unavailable" when the item DB is null', () => {
    renderModal({ itemDatabase: null })
    expect(screen.getByText('Database unavailable')).toBeInTheDocument()
    expect(screen.queryByLabelText('Search items')).toBeNull()
  })

  it('announces the result count in an aria-live region', () => {
    renderModal()
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(/item/)
  })

  it('axe accessibility: zero violations in the loaded grid', async () => {
    renderModal()
    expect(await axe(document.body)).toHaveNoViolations()
  })

  it('axe accessibility: zero violations with an item selected', async () => {
    renderModal()
    await userEvent.click(screen.getByRole('gridcell', { name: 'Calamity, Circlet' }))
    expect(await axe(document.body)).toHaveNoViolations()
  })

  it('axe accessibility: zero violations in the no-results (empty) state', async () => {
    renderModal()
    await userEvent.type(screen.getByLabelText('Search items'), 'zzzznomatch')
    expect(screen.getByText('No items match these filters')).toBeInTheDocument()
    expect(await axe(document.body)).toHaveNoViolations()
  })
})
