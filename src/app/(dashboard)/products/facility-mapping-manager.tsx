'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Facility {
  id: string
  name: string
  address: string | null
  repsuite_site_number: string | null
}

interface RepSuiteHospital {
  hospital_name: string
  hospital_site_number: string
}

export default function FacilityMappingManager({
  facilities,
  repsuiteHospitals,
  userRole,
}: {
  facilities: Facility[]
  repsuiteHospitals: RepSuiteHospital[]
  userRole: string
}) {
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const canEdit = userRole === 'admin' || userRole === 'manager'

  const mappedCount = facilities.filter((f) => f.repsuite_site_number).length

  return (
    <div className="space-y-4">
      {/* Stats + Add Button */}
      <div className="flex items-center justify-between">
        <div className="flex gap-4">
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-3">
          <span className="text-sm text-gray-500">Facilities</span>
          <span className="text-lg font-bold text-gray-900 ml-2">{facilities.length}</span>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-3">
          <span className="text-sm text-gray-500">Mapped</span>
          <span className="text-lg font-bold text-blue-600 ml-2">{mappedCount}</span>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-3">
          <span className="text-sm text-gray-500">Unmapped</span>
          <span className="text-lg font-bold text-amber-600 ml-2">{facilities.length - mappedCount}</span>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-3">
          <span className="text-sm text-gray-500">RepSuite Hospitals</span>
          <span className="text-lg font-bold text-gray-600 ml-2">{repsuiteHospitals.length}</span>
        </div>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition whitespace-nowrap"
          >
            + Add Facility
          </button>
        )}
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <CreateFacilityForm
          repsuiteHospitals={repsuiteHospitals}
          onClose={() => setShowCreateForm(false)}
        />
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 text-gray-600 font-medium">Facility</th>
                <th className="text-left py-3 px-4 text-gray-600 font-medium">RepSuite Hospital</th>
                <th className="text-center py-3 px-4 text-gray-600 font-medium">Status</th>
                {canEdit && <th className="text-right py-3 px-4 text-gray-600 font-medium w-20"></th>}
              </tr>
            </thead>
            <tbody>
              {facilities.map((facility) => {
                const mapping = repsuiteHospitals.find(
                  (h) => h.hospital_site_number === facility.repsuite_site_number
                )
                return (
                  <tr key={facility.id} className="border-b border-gray-50 hover:bg-gray-50/50 group/row">
                    <td className="py-3 px-4">
                      <span className="font-medium text-gray-900">{facility.name}</span>
                      {facility.address && (
                        <span className="block text-xs text-gray-400">{facility.address}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {mapping ? (
                        <div>
                          <span className="text-gray-700">{mapping.hospital_name.replace(/^\d+ - /, '')}</span>
                          <span className="block text-xs font-mono text-gray-400">Site # {mapping.hospital_site_number}</span>
                        </div>
                      ) : (
                        <span className="text-gray-300 italic">Not mapped</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {mapping ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                          Mapped
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                          Unmapped
                        </span>
                      )}
                    </td>
                    {canEdit && (
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setEditingFacility(facility)}
                          className="opacity-0 group-hover/row:opacity-100 transition-opacity p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                          title="Map to RepSuite"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
              {facilities.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 4 : 3} className="py-8 text-center text-gray-400">
                    No facilities yet. Facilities are created when inventory is scanned from the iOS app.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mapping Modal */}
      {editingFacility && (
        <MappingModal
          facility={editingFacility}
          repsuiteHospitals={repsuiteHospitals}
          onClose={() => setEditingFacility(null)}
        />
      )}
    </div>
  )
}

function MappingModal({
  facility,
  repsuiteHospitals,
  onClose,
}: {
  facility: Facility
  repsuiteHospitals: RepSuiteHospital[]
  onClose: () => void
}) {
  const [selected, setSelected] = useState<string | null>(facility.repsuite_site_number)
  const [saving, setSaving] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleSave = async () => {
    setSaving(true)
    await supabase
      .from('facilities')
      .update({ repsuite_site_number: selected })
      .eq('id', facility.id)
    setSaving(false)
    router.refresh()
    onClose()
  }

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) onClose()
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div ref={modalRef} className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Map to RepSuite</h2>
              <p className="text-sm text-gray-500">{facility.name}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="text-xs text-gray-400 mb-3">
            Select the RepSuite hospital that matches this facility. This links synced cases to the correct facility.
          </p>

          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            <button
              onClick={() => setSelected(null)}
              className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition ${
                selected === null
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-gray-100 hover:bg-gray-50 text-gray-600'
              }`}
            >
              <span className="font-medium">None</span>
              <span className="block text-xs text-gray-400">No RepSuite mapping</span>
            </button>

            {repsuiteHospitals.map((h) => (
              <button
                key={h.hospital_site_number}
                onClick={() => setSelected(h.hospital_site_number)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition ${
                  selected === h.hospital_site_number
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : 'border-gray-100 hover:bg-gray-50 text-gray-700'
                }`}
              >
                <span className="font-medium">{h.hospital_name.replace(/^\d+ - /, '')}</span>
                <span className="block text-xs text-gray-400 font-mono">Site # {h.hospital_site_number}</span>
              </button>
            ))}

            {repsuiteHospitals.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">
                No RepSuite hospitals found. Sync cases first to populate this list.
              </p>
            )}
          </div>

          <div className="flex gap-3 justify-end mt-4 pt-4 border-t border-gray-100">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CreateFacilityForm({
  repsuiteHospitals,
  onClose,
}: {
  repsuiteHospitals: RepSuiteHospital[]
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [repsuiteSiteNumber, setRepsuiteSiteNumber] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Facility name is required.')
      return
    }
    setSaving(true)
    setError(null)

    const { data: user } = await supabase.auth.getUser()
    const { error: insertError } = await supabase.from('facilities').insert({
      name: name.trim(),
      address: address.trim() || null,
      repsuite_site_number: repsuiteSiteNumber,
      user_id: user?.user?.id,
    })

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
    } else {
      router.refresh()
      onClose()
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Facility</h3>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Facility Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Physicians Regional North"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Optional"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">RepSuite Hospital</label>
          <select
            value={repsuiteSiteNumber ?? ''}
            onChange={(e) => setRepsuiteSiteNumber(e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="">None — no RepSuite mapping</option>
            {repsuiteHospitals.map((h) => (
              <option key={h.hospital_site_number} value={h.hospital_site_number}>
                {h.hospital_name.replace(/^\d+ - /, '')} (Site # {h.hospital_site_number})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-3 mt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Add Facility'}
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
