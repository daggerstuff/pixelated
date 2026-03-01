import React, { useState } from 'react'

// Helper function for string concatenation
const formatStorageLocation = (type, bucket) => {
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

  const handleInputChange = (e) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      const { checked } = e.target
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

  const handleSubmit = (e) => {
    e.preventDefault()
    setIsFormLoading(true)
    // Simulate API call
    setTimeout(() => {
      const id = Math.random().toString(36).substring(7)
      // Handle default location changes
      setLocations((prev) => {
        let updatedLocations = [...prev]
        if (newLocation.isDefault) {
          updatedLocations = updatedLocations.map((loc) => ({
            ...loc,
            isDefault: false,
          }))
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
          status: 'active',
          lastSync: new Date().toISOString(),
        }
        return [...updatedLocations, createdLocation]
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

  const setDefaultLocation = (id) => {
    setLocations((prev) =>
      prev.map((location) => ({
        ...location,
        isDefault: location.id === id,
      })),
    )
  }

  const removeLocation = (id) => {
    // Don't allow removing the default location
    const locationToRemove = locations.find((loc) => loc.id === id)
    if (locationToRemove?.isDefault) {
      return
    }
    setLocations((prev) => prev.filter((location) => location.id !== id))
  }

  const testConnection = (id) => {
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
    <div className='bg-white dark:bg-gray-800 rounded-lg shadow-sm'>
      <div className='border-gray-200 dark:border-gray-700 border-b px-6 py-4'>
        <div className='flex items-center justify-between'>
          <div>
            <h3 className='text-lg font-semibold'>Backup Storage Locations</h3>
            <p className='text-gray-500 dark:text-gray-400 mt-1 text-sm'>
              Configure where backup data is stored. For redundancy, configure
              multiple locations.
            </p>
          </div>
          <button
            type='button'
            onClick={handleAddLocation}
            disabled={isAddingLocation}
            className='border-transparent text-white inline-flex items-center rounded-md border bg-primary-600 px-4 py-2 text-sm font-medium shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2'
          >
            Add Location
          </button>
        </div>
      </div>

      <div className='overflow-x-auto'>
        <table className='divide-gray-200 dark:divide-gray-700 min-w-full divide-y'>
          <thead className='bg-gray-50 dark:bg-gray-750'>
            <tr>
              <th
                scope='col'
                className='text-gray-500 dark:text-gray-400 px-6 py-3 text-left text-xs font-medium uppercase tracking-wider'
              >
                Name
              </th>
              <th
                scope='col'
                className='text-gray-500 dark:text-gray-400 px-6 py-3 text-left text-xs font-medium uppercase tracking-wider'
              >
                Type
              </th>
              <th
                scope='col'
                className='text-gray-500 dark:text-gray-400 px-6 py-3 text-left text-xs font-medium uppercase tracking-wider'
              >
                Location
              </th>
              <th
                scope='col'
                className='text-gray-500 dark:text-gray-400 px-6 py-3 text-left text-xs font-medium uppercase tracking-wider'
              >
                Status
              </th>
              <th
                scope='col'
                className='text-gray-500 dark:text-gray-400 px-6 py-3 text-left text-xs font-medium uppercase tracking-wider'
              >
                Default
              </th>
              <th
                scope='col'
                className='text-gray-500 dark:text-gray-400 px-6 py-3 text-left text-xs font-medium uppercase tracking-wider'
              >
                Last Sync
              </th>
              <th scope='col' className='relative px-6 py-3'>
                <span className='sr-only'>Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className='bg-white divide-gray-200 dark:bg-gray-800 dark:divide-gray-700 divide-y'>
            {locations.map(function (location) {
              return (
                <tr key={location.id}>
                  <td className='text-gray-900 dark:text-white whitespace-nowrap px-6 py-4 text-sm font-medium'>
                    {location.name}
                  </td>
                  <td className='text-gray-500 dark:text-gray-300 whitespace-nowrap px-6 py-4 text-sm'>
                    {location.type === 'local' && 'Local Storage'}
                    {location.type === 's3' && 'AWS S3'}
                    {location.type === 'azure' && 'Azure Blob Storage'}
                    {location.type === 'gcp' && 'Google Cloud Storage'}
                  </td>
                  <td className='text-gray-500 dark:text-gray-300 whitespace-nowrap px-6 py-4 text-sm'>
                    {location.type === 'local' && location.path}
                    {location.type === 's3' &&
                      formatStorageLocation('s3', location.bucket)}
                    {location.type === 'azure' &&
                      formatStorageLocation('azure', location.bucket)}
                    {location.type === 'gcp' &&
                      formatStorageLocation('gcp', location.bucket)}
                  </td>
                  <td className='whitespace-nowrap px-6 py-4'>
                    {location.status === 'active' && (
                      <span className='bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100 inline-flex rounded-full px-2 text-xs font-semibold leading-5'>
                        Active
                      </span>
                    )}
                    {location.status === 'error' && (
                      <span className='bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100 inline-flex rounded-full px-2 text-xs font-semibold leading-5'>
                        Error
                      </span>
                    )}
                    {location.status === 'configuring' && (
                      <span className='bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100 inline-flex rounded-full px-2 text-xs font-semibold leading-5'>
                        Configuring...
                      </span>
                    )}
                  </td>
                  <td className='text-gray-500 dark:text-gray-300 whitespace-nowrap px-6 py-4 text-sm'>
                    {location.isDefault ? (
                      <span className='font-medium text-primary-600 dark:text-primary-400'>
                        Default
                      </span>
                    ) : (
                      <button
                        onClick={function () {
                          return setDefaultLocation(location.id)
                        }}
                        className='text-gray-600 dark:text-gray-400 font-medium hover:text-primary-600 dark:hover:text-primary-400'
                      >
                        Set as default
                      </button>
                    )}
                  </td>
                  <td className='text-gray-500 dark:text-gray-300 whitespace-nowrap px-6 py-4 text-sm'>
                    {location.lastSync
                      ? new Date(location.lastSync).toLocaleString()
                      : '-'}
                  </td>
                  <td className='whitespace-nowrap px-6 py-4 text-right text-sm font-medium'>
                    <div className='flex justify-end space-x-2'>
                      <button
                        onClick={function () {
                          return testConnection(location.id)
                        }}
                        disabled={location.status === 'configuring'}
                        className='text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300'
                      >
                        Test
                      </button>
                      {!location.isDefault && (
                        <button
                          onClick={function () {
                            return removeLocation(location.id)
                          }}
                          className='text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300'
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
        <div className='border-gray-200 dark:border-gray-700 border-t p-6'>
          <h4 className='mb-4 text-lg font-medium'>Add New Storage Location</h4>
          <form onSubmit={handleSubmit} className='space-y-6'>
            <div className='grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-6'>
              <div className='sm:col-span-3'>
                <label
                  htmlFor='name'
                  className='text-gray-700 dark:text-gray-300 block text-sm font-medium'
                >
                  Location Name
                </label>
                <input
                  type='text'
                  name='name'
                  id='name'
                  value={newLocation.name}
                  onChange={handleInputChange}
                  required
                  className='border-gray-300 dark:border-gray-600 dark:bg-gray-700 mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm'
                />
              </div>

              <div className='sm:col-span-3'>
                <label
                  htmlFor='type'
                  className='text-gray-700 dark:text-gray-300 block text-sm font-medium'
                >
                  Storage Type
                </label>
                <select
                  id='type'
                  name='type'
                  value={newLocation.type}
                  onChange={handleInputChange}
                  className='border-gray-300 dark:border-gray-600 dark:bg-gray-700 mt-1 block w-full rounded-md py-2 pl-3 pr-10 text-base focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm'
                >
                  <option value='local'>Local Storage</option>
                  <option value='s3'>AWS S3</option>
                  <option value='azure'>Azure Blob Storage</option>
                  <option value='gcp'>Google Cloud Storage</option>
                </select>
              </div>

              {newLocation.type === 'local' && (
                <div className='sm:col-span-6'>
                  <label
                    htmlFor='path'
                    className='text-gray-700 dark:text-gray-300 block text-sm font-medium'
                  >
                    File Path
                  </label>
                  <input
                    type='text'
                    name='path'
                    id='path'
                    value={newLocation.path}
                    onChange={handleInputChange}
                    required
                    placeholder='/path/to/backup/directory'
                    className='border-gray-300 dark:border-gray-600 dark:bg-gray-700 mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm'
                  />
                </div>
              )}

              {(newLocation.type === 's3' ||
                newLocation.type === 'azure' ||
                newLocation.type === 'gcp') && (
                <>
                  <div className='sm:col-span-4'>
                    <label
                      htmlFor='bucket'
                      className='text-gray-700 dark:text-gray-300 block text-sm font-medium'
                    >
                      Bucket Name
                    </label>
                    <input
                      type='text'
                      name='bucket'
                      id='bucket'
                      value={newLocation.bucket}
                      onChange={handleInputChange}
                      required
                      className='border-gray-300 dark:border-gray-600 dark:bg-gray-700 mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm'
                    />
                  </div>

                  {newLocation.type === 's3' && (
                    <div className='sm:col-span-2'>
                      <label
                        htmlFor='region'
                        className='text-gray-700 dark:text-gray-300 block text-sm font-medium'
                      >
                        Region
                      </label>
                      <input
                        type='text'
                        name='region'
                        id='region'
                        value={newLocation.region}
                        onChange={handleInputChange}
                        placeholder='us-west-2'
                        className='border-gray-300 dark:border-gray-600 dark:bg-gray-700 mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm'
                      />
                    </div>
                  )}
                </>
              )}

              <div className='sm:col-span-6'>
                <div className='mt-3 flex items-start'>
                  <div className='flex h-5 items-center'>
                    <input
                      id='isDefault'
                      name='isDefault'
                      type='checkbox'
                      checked={newLocation.isDefault}
                      onChange={handleInputChange}
                      className='border-gray-300 dark:border-gray-600 dark:bg-gray-700 h-4 w-4 rounded text-primary-600 focus:ring-primary-500'
                    />
                  </div>
                  <div className='ml-3 text-sm'>
                    <label
                      htmlFor='isDefault'
                      className='text-gray-700 dark:text-gray-300 font-medium'
                    >
                      Make this the default backup location
                    </label>
                    <p className='text-gray-500 dark:text-gray-400'>
                      Default locations are used for all backups unless
                      otherwise specified
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className='flex justify-end space-x-3'>
              <button
                type='button'
                onClick={handleCancelAdd}
                className='border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-650 inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2'
              >
                Cancel
              </button>
              <button
                type='submit'
                disabled={isFormLoading}
                className={`border-transparent text-white inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium shadow-sm ${
                  isFormLoading
                    ? 'bg-gray-400'
                    : 'bg-primary-600 hover:bg-primary-700'
                } focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2`}
              >
                {isFormLoading ? (
                  <>
                    <svg
                      className='text-white -ml-1 mr-2 h-4 w-4 animate-spin'
                      xmlns='http://www.w3.org/2000/svg'
                      fill='none'
                      viewBox='0 0 24 24'
                    >
                      <circle
                        className='opacity-25'
                        cx='12'
                        cy='12'
                        r='10'
                        stroke='currentColor'
                        strokeWidth='4'
                      ></circle>
                      <path
                        className='opacity-75'
                        fill='currentColor'
                        d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
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
