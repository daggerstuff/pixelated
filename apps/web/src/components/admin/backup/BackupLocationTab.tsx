import React, { useState, SyntheticEvent } from 'react'
// Helper function for string concatenation
const formatStorageLocation = (type: string, bucket: string): string => {
  switch (type) {
    case 's3':
      return `s3://${bucket}`
    case 'azure':
      return `Azure: ${bucket}`
    case 'gcp':
      return `GCS: ${bucket}`
    default:
      return ''
  }
}

export default function BackupLocationTab() {
  const [locations, setLocations] = useState([
    {
      id: '1',
      name: 'Local Storage',
      type: 'local',
      path: '/var/backups/pixelated',
      credentialsValid: true,
      isDefault: true,
      status: 'active',
      lastSync: '2025-03-15T14:30:00Z',
    },
    {
      id: '2',
      name: 'AWS S3 Backup',
      type: 's3',
      bucket: 'pixelated-backups',
      region: 'us-west-2',
      credentialsValid: true,
      isDefault: false,
      status: 'active',
      lastSync: '2025-03-15T14:30:00Z',
    },
  ])
  const [isAddingLocation, setIsAddingLocation] = useState(false)
  const [isFormLoading, setIsFormLoading] = useState(false)
  const [newLocation, setNewLocation] = useState({
    type: 'local',
    name: '',
    path: '',
    bucket: '',
    region: '',
    isDefault: false,
  })

  const handleAddLocation = () => {
    setIsAddingLocation(true)
  }

  const handleCancelAdd = () => {
    setIsAddingLocation(false)
    setNewLocation({
      type: 'local',
      name: '',
      path: '',
      bucket: '',
      region: '',
      isDefault: false,
    })
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target as HTMLInputElement
    if (type === 'checkbox') {
      const { checked } = e.target as HTMLInputElement
      setNewLocation({
        ...newLocation,
        [name]: checked,
      })
    } else {
      setNewLocation({
        ...newLocation,
        [name]: value,
      })
    }
  }

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsFormLoading(true)
    // Simulate API call
    setTimeout(() => {
      const id = Math.random().toString(36).substring(7)
      // Handle default location changes
      setLocations((prev) => {
        const updatedLocations = [...prev]
        if (newLocation.isDefault) {
          for (let i = 0; i < updatedLocations.length; i++) {
            const item = updatedLocations[i]
            if (item) updatedLocations[i] = { ...item, isDefault: false }
          }
        }
        const createdLocation = {
          id,
          name: newLocation.name || 'New Location',
          type: newLocation.type,
          path: newLocation.path,
          bucket: newLocation.bucket,
          region: newLocation.region,
          credentialsValid: true,
          isDefault: newLocation.isDefault || false,
          status: 'active' as const,
          lastSync: new Date().toISOString(),
        }
        return [...updatedLocations, createdLocation] as typeof prev
      })
      setIsAddingLocation(false)
      setIsFormLoading(false)
      setNewLocation({
        type: 'local',
        name: '',
        path: '',
        bucket: '',
        region: '',
        isDefault: false,
      })
    }, 1000)
  }

  const setDefaultLocation = (id: string): void => {
    setLocations((prev) =>
      prev.map((location) => ({
        ...location,
        isDefault: location.id === id,
      })),
    )
  }

  const removeLocation = (id: string): void => {
    // Don't allow removing the default location
    const locationToRemove = locations.find((loc) => loc.id === id)
    if (locationToRemove?.isDefault) {
      return
    }
    setLocations((prev) => prev.filter((location) => location.id !== id))
  }

  const testConnection = (id: string): void => {
    setLocations((prev) =>
      prev.map((location) =>
        location.id === id ? { ...location, status: 'configuring' } : location,
      ),
    )
    // Simulate testing connection
    setTimeout(() => {
      setLocations((prev) =>
        prev.map((location) =>
          location.id === id
            ? {
                ...location,
                status: 'active',
                credentialsValid: true,
                lastSync: new Date().toISOString(),
              }
            : location,
        ),
      )
    }, 2000)
  }

  return (
    <div className="rounded-none bg-card">
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Backup Storage Locations</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Configure where backup data is stored. For redundancy, configure
              multiple locations.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddLocation}
            disabled={isAddingLocation}
            className="border-transparent text-white bg-primary-600 hover:bg-primary-700 focus:ring-primary-500 inline-flex items-center rounded-none border px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2"
          >
            Add Location
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-secondary">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                Name
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                Type
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                Location
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                Status
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                Default
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                Last Sync
              </th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {locations.map(function (location) {
              return (
                <tr key={location.id}>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-foreground">
                    {location.name}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                    {location.type === 'local' && 'Local Storage'}
                    {location.type === 's3' && 'AWS S3'}
                    {location.type === 'azure' && 'Azure Blob Storage'}
                    {location.type === 'gcp' && 'Google Cloud Storage'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                    {location.type === 'local' && location.path}
                    {location.type === 's3' &&
                      formatStorageLocation('s3', location.bucket!)}
                    {location.type === 'azure' &&
                      formatStorageLocation('azure', location.bucket!)}
                    {location.type === 'gcp' &&
                      formatStorageLocation('gcp', location.bucket!)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    {location.status === 'active' && (
                      <span className="inline-flex rounded-none border border-input bg-secondary px-2 text-xs font-semibold leading-5 text-foreground">
                        Active
                      </span>
                    )}
                    {location.status === 'error' && (
                      <span className="inline-flex rounded-none border border-ring bg-card px-2 text-xs font-semibold leading-5 text-foreground">
                        Error
                      </span>
                    )}
                    {location.status === 'configuring' && (
                      <span className="inline-flex rounded-none border border-ring bg-secondary px-2 text-xs font-semibold leading-5 text-foreground">
                        Configuring...
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                    {location.isDefault ? (
                      <span className="text-primary-600 font-medium">
                        Default
                      </span>
                    ) : (
                      <button
                        onClick={function () {
                          return setDefaultLocation(location.id)
                        }}
                        className="hover:text-primary-600 font-medium text-muted-foreground"
                      >
                        Set as default
                      </button>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                    {location.lastSync
                      ? new Date(location.lastSync).toLocaleString()
                      : '-'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={function () {
                          return testConnection(location.id)
                        }}
                        disabled={location.status === 'configuring'}
                        className="font-medium text-foreground hover:underline"
                      >
                        Test
                      </button>
                      {!location.isDefault && (
                        <button
                          onClick={function () {
                            return removeLocation(location.id)
                          }}
                          className="font-medium text-foreground hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {isAddingLocation && (
        <div className="border-t border-border p-6">
          <h4 className="mb-4 text-lg font-medium">Add New Storage Location</h4>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-6">
              <div className="sm:col-span-3">
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-foreground"
                >
                  Location Name
                </label>
                <input
                  type="text"
                  name="name"
                  id="name"
                  value={newLocation.name}
                  onChange={handleInputChange}
                  required
                  className="focus:border-primary-500 focus:ring-primary-500 mt-1 block w-full rounded-none border border-input px-3 py-2 focus:outline-none sm:text-sm"
                />
              </div>

              <div className="sm:col-span-3">
                <label
                  htmlFor="type"
                  className="block text-sm font-medium text-foreground"
                >
                  Storage Type
                </label>
                <select
                  id="type"
                  name="type"
                  value={newLocation.type}
                  onChange={handleInputChange}
                  className="focus:border-primary-500 focus:ring-primary-500 mt-1 block w-full rounded-none border-input py-2 pl-3 pr-10 text-base focus:outline-none sm:text-sm"
                >
                  <option value="local">Local Storage</option>
                  <option value="s3">AWS S3</option>
                  <option value="azure">Azure Blob Storage</option>
                  <option value="gcp">Google Cloud Storage</option>
                </select>
              </div>

              {newLocation.type === 'local' && (
                <div className="sm:col-span-6">
                  <label
                    htmlFor="path"
                    className="block text-sm font-medium text-foreground"
                  >
                    File Path
                  </label>
                  <input
                    type="text"
                    name="path"
                    id="path"
                    value={newLocation.path}
                    onChange={handleInputChange}
                    required
                    placeholder="/path/to/backup/directory"
                    className="focus:border-primary-500 focus:ring-primary-500 mt-1 block w-full rounded-none border border-input px-3 py-2 focus:outline-none sm:text-sm"
                  />
                </div>
              )}

              {(newLocation.type === 's3' ||
                newLocation.type === 'azure' ||
                newLocation.type === 'gcp') && (
                <>
                  <div className="sm:col-span-4">
                    <label
                      htmlFor="bucket"
                      className="block text-sm font-medium text-foreground"
                    >
                      Bucket Name
                    </label>
                    <input
                      type="text"
                      name="bucket"
                      id="bucket"
                      value={newLocation.bucket}
                      onChange={handleInputChange}
                      required
                      className="focus:border-primary-500 focus:ring-primary-500 mt-1 block w-full rounded-none border border-input px-3 py-2 focus:outline-none sm:text-sm"
                    />
                  </div>

                  {newLocation.type === 's3' && (
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="region"
                        className="block text-sm font-medium text-foreground"
                      >
                        Region
                      </label>
                      <input
                        type="text"
                        name="region"
                        id="region"
                        value={newLocation.region}
                        onChange={handleInputChange}
                        placeholder="us-west-2"
                        className="focus:border-primary-500 focus:ring-primary-500 mt-1 block w-full rounded-none border border-input px-3 py-2 focus:outline-none sm:text-sm"
                      />
                    </div>
                  )}
                </>
              )}

              <div className="sm:col-span-6">
                <div className="mt-3 flex items-start">
                  <div className="flex h-5 items-center">
                    <input
                      id="isDefault"
                      name="isDefault"
                      type="checkbox"
                      checked={newLocation.isDefault}
                      onChange={handleInputChange}
                      className="text-primary-600 focus:ring-primary-500 h-4 w-4 rounded-none border-input"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label
                      htmlFor="isDefault"
                      className="font-medium text-foreground"
                    >
                      Make this the default backup location
                    </label>
                    <p className="text-muted-foreground">
                      Default locations are used for all backups unless
                      otherwise specified
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleCancelAdd}
                className="focus:ring-primary-500 inline-flex items-center rounded-none border border-input bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isFormLoading}
                className={`border-transparent text-white inline-flex items-center rounded-none border px-4 py-2 text-sm font-medium ${
                  isFormLoading
                    ? 'bg-secondary text-muted-foreground'
                    : 'bg-primary-600 hover:bg-primary-700'
                } focus:ring-primary-500 focus:outline-none focus:ring-2 focus:ring-offset-2`}
              >
                {isFormLoading ? (
                  <>
                    <svg
                      className="text-white -ml-1 mr-2 h-4 w-4 animate-spin"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Adding...
                  </>
                ) : (
                  'Add Location'
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
