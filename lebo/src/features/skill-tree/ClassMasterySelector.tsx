import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react'
import { useGameDataStore } from '../../shared/stores/gameDataStore'
import { useBuildStore } from '../../shared/stores/buildStore'

export function ClassMasterySelector() {
  const gameData = useGameDataStore((s) => s.gameData)
  const selectedClassId = useBuildStore((s) => s.selectedClassId)
  const selectedMasteryId = useBuildStore((s) => s.selectedMasteryId)
  const setSelectedClass = useBuildStore((s) => s.setSelectedClass)
  const setSelectedMastery = useBuildStore((s) => s.setSelectedMastery)
  const createBuild = useBuildStore((s) => s.createBuild)

  if (!gameData) return null

  const classList = Object.values(gameData.classes).sort((a, b) =>
    a.className.localeCompare(b.className)
  )

  const selectedClass = selectedClassId ? gameData.classes[selectedClassId] : null
  const masteryList = selectedClass
    ? Object.values(selectedClass.masteries).sort((a, b) =>
        a.masteryName.localeCompare(b.masteryName)
      )
    : []
  const selectedMastery =
    selectedMasteryId && selectedClass ? selectedClass.masteries[selectedMasteryId] : null

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
        Class
      </p>

      <Listbox value={selectedClassId ?? undefined} onChange={(id: string) => setSelectedClass(id)}>
        <ListboxButton
          id="class-selector-btn"
          className="w-full px-3 py-2 text-sm text-left rounded flex justify-between items-center"
          style={{
            backgroundColor: 'var(--color-bg-elevated)',
            color: selectedClass ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
            border: '1px solid var(--color-bg-elevated)',
          }}
        >
          <span>{selectedClass?.className ?? 'Select Class'}</span>
          <span style={{ color: 'var(--color-text-muted)' }}>▾</span>
        </ListboxButton>

        <ListboxOptions
          anchor="bottom start"
          className="z-50 mt-1 rounded shadow-lg overflow-hidden focus:outline-none"
          style={{
            backgroundColor: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-bg-base)',
            width: 'var(--button-width)',
          }}
        >
          {classList.map((cls) => (
            <ListboxOption
              key={cls.classId}
              value={cls.classId}
              className="px-3 py-2 text-sm cursor-pointer"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {({ focus }: { focus: boolean }) => (
                <span
                  style={{
                    display: 'block',
                    backgroundColor: focus ? 'var(--color-bg-base)' : 'transparent',
                    padding: '2px 4px',
                    borderRadius: '2px',
                  }}
                >
                  {cls.className}
                </span>
              )}
            </ListboxOption>
          ))}
        </ListboxOptions>
      </Listbox>

      {selectedClass && (
        <>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
            Mastery
          </p>

          <Listbox
            value={selectedMasteryId ?? undefined}
            onChange={(id: string) => {
              setSelectedMastery(id)
              const masteryName = selectedClass?.masteries[id]?.masteryName ?? id
              createBuild(masteryName)
            }}
          >
            <ListboxButton
              className="w-full px-3 py-2 text-sm text-left rounded flex justify-between items-center"
              style={{
                backgroundColor: 'var(--color-bg-elevated)',
                color: selectedMastery ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                border: '1px solid var(--color-bg-elevated)',
              }}
            >
              <span>{selectedMastery?.masteryName ?? 'Select Mastery'}</span>
              <span style={{ color: 'var(--color-text-muted)' }}>▾</span>
            </ListboxButton>

            <ListboxOptions
              anchor="bottom start"
              className="z-50 mt-1 rounded shadow-lg overflow-hidden focus:outline-none"
              style={{
                backgroundColor: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-bg-base)',
                width: 'var(--button-width)',
              }}
            >
              {masteryList.map((mastery) => (
                <ListboxOption
                  key={mastery.masteryId}
                  value={mastery.masteryId}
                  className="px-3 py-2 text-sm cursor-pointer"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {({ focus }: { focus: boolean }) => (
                    <span
                      style={{
                        display: 'block',
                        backgroundColor: focus ? 'var(--color-bg-base)' : 'transparent',
                        padding: '2px 4px',
                        borderRadius: '2px',
                      }}
                    >
                      {mastery.masteryName}
                    </span>
                  )}
                </ListboxOption>
              ))}
            </ListboxOptions>
          </Listbox>
        </>
      )}
    </div>
  )
}
