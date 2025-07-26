'use strict'
var __assign =
  (this && this.__assign) ||
  function () {
    __assign =
      Object.assign ||
      function (t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i]
          for (var p in s)
            if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p]
        }
        return t
      }
    return __assign.apply(this, arguments)
  }
var __spreadArray =
  (this && this.__spreadArray) ||
  function (to, from, pack) {
    if (pack || arguments.length === 2)
      for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
          if (!ar) ar = Array.prototype.slice.call(from, 0, i)
          ar[i] = from[i]
        }
      }
    return to.concat(ar || Array.prototype.slice.call(from))
  }
Object.defineProperty(exports, '__esModule', { value: true })
import React, { useState } from 'react'

// Helper function for string concatenation
const formatStorageLocation = (type, bucket) => {
  if (type === 's3') return `s3://${bucket}`
  if (type === 'azure') return `Azure: ${bucket}`
  if (type === 'gcp') return `GCS: ${bucket}`
  return ''
}

const BackupLocationTab = function () {
  var _a = useState([
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
    ]),
    locations = _a[0],
    setLocations = _a[1]
  var _b = useState(false),
    isAddingLocation = _b[0],
    setIsAddingLocation = _b[1]
  var _c = useState(false),
    isFormLoading = _c[0],
    setIsFormLoading = _c[1]
  var _d = useState({
      type: 'local',
      name: '',
      path: '',
      bucket: '',
      region: '',
      isDefault: false,
    }),
    newLocation = _d[0],
    setNewLocation = _d[1]
  var handleAddLocation = function () {
    setIsAddingLocation(true)
  }
  var handleCancelAdd = function () {
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
  var handleInputChange = function (e) {
    var _a, _b
    var _c = e.target,
      name = _c.name,
      value = _c.value,
      type = _c.type
    if (type === 'checkbox') {
      var target = e.target
      setNewLocation(
        __assign(
          __assign({}, newLocation),
          ((_a = {}), (_a[name] = target.checked), _a),
        ),
      )
    } else {
      setNewLocation(
        __assign(
          __assign({}, newLocation),
          ((_b = {}), (_b[name] = value), _b),
        ),
      )
    }
  }
  var handleSubmit = function (e) {
    e.preventDefault()
    setIsFormLoading(true)
    // Simulate API call
    setTimeout(function () {
      var id = Math.random().toString(36).substring(7)
      // Handle default location changes
      var updatedLocations = __spreadArray([], locations, true)
      if (newLocation.isDefault) {
        updatedLocations = updatedLocations.map(function (loc) {
          return __assign(__assign({}, loc), { isDefault: false })
        })
      }
      var createdLocation = {
        id: id,
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
      setLocations(
        __spreadArray(
          __spreadArray([], updatedLocations, true),
          [createdLocation],
          false,
        ),
      )
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
  var setDefaultLocation = function (id) {
    setLocations(
      locations.map(function (location) {
        return __assign(__assign({}, location), {
          isDefault: location.id === id,
        })
      }),
    )
  }
  var removeLocation = function (id) {
    // Don't allow removing the default location
    var locationToRemove = locations.find(function (loc) {
      return loc.id === id
    })
    if (
      locationToRemove === null || locationToRemove === void 0
        ? void 0
        : locationToRemove.isDefault
    ) {
      return
    }
    setLocations(
      locations.filter(function (location) {
        return location.id !== id
      }),
    )
  }
  var testConnection = function (id) {
    setLocations(
      locations.map(function (location) {
        return location.id === id
          ? __assign(__assign({}, location), { status: 'configuring' })
          : location
      }),
    )
    // Simulate testing connection
    setTimeout(function () {
      setLocations(
        locations.map(function (location) {
          return location.id === id
            ? __assign(__assign({}, location), {
                status: 'active',
                credentialsValid: true,
                lastSync: new Date().toISOString(),
              })
            : location
        }),
      )
    }, 2000)
  }
  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold">Backup Storage Locations</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Configure where backup data is stored. For redundancy, configure
              multiple locations.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddLocation}
            disabled={isAddingLocation}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Add Location
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-750">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                Name
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                Type
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                Location
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                Status
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                Default
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                Last Sync
              </th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
            {locations.map(function (location) {
              return (
                <tr key={location.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {location.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {location.type === 'local' && 'Local Storage'}
                    {location.type === 's3' && 'AWS S3'}
                    {location.type === 'azure' && 'Azure Blob Storage'}
                    {location.type === 'gcp' && 'Google Cloud Storage'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {location.type === 'local' && location.path}
                    {location.type === 's3' &&
                      formatStorageLocation('s3', location.bucket)}
                    {location.type === 'azure' &&
                      formatStorageLocation('azure', location.bucket)}
                    {location.type === 'gcp' &&
                      formatStorageLocation('gcp', location.bucket)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {location.status === 'active' && (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
                        Active
                      </span>
                    )}
                    {location.status === 'error' && (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100">
                        Error
                      </span>
                    )}
                    {location.status === 'configuring' && (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100">
                        Configuring...
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {location.isDefault ? (
                      <span className="text-primary-600 dark:text-primary-400 font-medium">
                        Default
                      </span>
                    ) : (
                      <button
                        onClick={function () {
                          return setDefaultLocation(location.id)
                        }}
                        className="text-gray-600 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 font-medium"
                      >
                        Set as default
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {location.lastSync
                      ? new Date(location.lastSync).toLocaleString()
                      : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex space-x-2 justify-end">
                      <button
                        onClick={function () {
                          return testConnection(location.id)
                        }}
                        disabled={location.status === 'configuring'}
                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                      >
                        Test
                      </button>
                      {!location.isDefault && (
                        <button
                          onClick={function () {
                            return removeLocation(location.id)
                          }}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
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
        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-lg font-medium mb-4">Add New Storage Location</h4>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-3">
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
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
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm dark:bg-gray-700"
                />
              </div>

              <div className="sm:col-span-3">
                <label
                  htmlFor="type"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Storage Type
                </label>
                <select
                  id="type"
                  name="type"
                  value={newLocation.type}
                  onChange={handleInputChange}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md dark:bg-gray-700"
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
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
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
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm dark:bg-gray-700"
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
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300"
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
                      className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm dark:bg-gray-700"
                    />
                  </div>

                  {newLocation.type === 's3' && (
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="region"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
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
                        className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm dark:bg-gray-700"
                      />
                    </div>
                  )}
                </>
              )}

              <div className="sm:col-span-6">
                <div className="flex items-start mt-3">
                  <div className="flex items-center h-5">
                    <input
                      id="isDefault"
                      name="isDefault"
                      type="checkbox"
                      checked={newLocation.isDefault}
                      onChange={handleInputChange}
                      className="focus:ring-primary-500 h-4 w-4 text-primary-600 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label
                      htmlFor="isDefault"
                      className="font-medium text-gray-700 dark:text-gray-300"
                    >
                      Make this the default backup location
                    </label>
                    <p className="text-gray-500 dark:text-gray-400">
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
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-650 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isFormLoading}
                className={`inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${
                  isFormLoading
                    ? 'bg-gray-400'
                    : 'bg-primary-600 hover:bg-primary-700'
                } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500`}
              >
                {isFormLoading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
export default BackupLocationTab
