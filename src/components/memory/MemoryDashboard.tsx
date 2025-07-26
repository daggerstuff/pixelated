'use client'

import { useState, useEffect, useCallback } from 'react'
import { useMemory, useUserPreferences } from '@/hooks/useMemory'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import {
  Search,
  Plus,
  Trash2,
  Edit,
  BarChart3,
  Brain,
  Clock,
  Tag,
  User,
} from 'lucide-react'
import type { MemoryEntry } from '@/lib/memory/memory-client'

interface MemoryDashboardProps {
  userId?: string
  showUserSelector?: boolean
}

const MEMORY_CATEGORIES = [
  'general',
  'conversation',
  'preference',
  'project',
  'learning',
  'feedback',
  'goal',
  'note',
]

export function MemoryDashboard({
  userId = 'default_user',
  showUserSelector = false,
}: MemoryDashboardProps) {
  const [currentUserId, setCurrentUserId] = useState(userId)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchResults, setSearchResults] = useState<MemoryEntry[]>([])
  const [, setIsSearching] = useState(false)

  // New memory form
  const [, setIsAddModalOpen] = useState(false)
  const [newMemoryContent, setNewMemoryContent] = useState('')
  const [newMemoryCategory, setNewMemoryCategory] = useState('general')
  const [newMemoryTags, setNewMemoryTags] = useState('')

  // Edit memory
  const [editingMemory, setEditingMemory] = useState<MemoryEntry | null>(null)
  const [editContent, setEditContent] = useState('')

  const memory = useMemory({
    userId: currentUserId,
    autoLoad: true,
    ...(selectedCategory !== 'all' && { category: selectedCategory }),
  })

  const userPrefs = useUserPreferences(currentUserId)

  const handleAddMemory = async () => {
    if (!newMemoryContent.trim()) {
      toast.error('Memory content is required')
      return
    }

    try {
      const tags = newMemoryTags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
      await memory.addMemory(newMemoryContent, {
        category: newMemoryCategory,
        tags,
        importance: 1,
      })

      setNewMemoryContent('')
      setNewMemoryCategory('general')
      setNewMemoryTags('')
      setIsAddModalOpen(false)
      toast.success('Memory added successfully')
    } catch (_error) {
      toast.error('Failed to add memory')
    }
  }

  const handleEditMemory = async () => {
    if (!editingMemory?.id || !editContent.trim()) {
      return
    }

    try {
      await memory.updateMemory(editingMemory.id, editContent)
      setEditingMemory(null)
      setEditContent('')
      toast.success('Memory updated successfully')
    } catch (_error) {
      toast.error('Failed to update memory')
    }
  }

  const handleDeleteMemory = async (memoryId: string) => {
    try {
      await memory.deleteMemory(memoryId)
      toast.success('Memory deleted successfully')
    } catch (_error) {
      toast.error('Failed to delete memory')
    }
  }

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) {
      return 'Unknown'
    }
    return new Date(timestamp).toLocaleString()
  }

  const filteredMemories =
    searchQuery && searchResults.length > 0 ? searchResults : memory.memories

  const handleSearchDebounced = useCallback(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    memory
      .searchMemories(searchQuery, {
        ...(selectedCategory !== 'all' && { category: selectedCategory }),
        limit: 20,
      })
      .then((results) => {
        setSearchResults(results)
      })
      .catch(() => {
        toast.error('Search failed')
      })
      .finally(() => {
        setIsSearching(false)
      })
  }, [searchQuery, selectedCategory, memory])

  useEffect(() => {
    if (searchQuery) {
      const timeoutId = setTimeout(handleSearchDebounced, 300)
      return () => clearTimeout(timeoutId)
    }
    setSearchResults([])
    return undefined
  }, [searchQuery, handleSearchDebounced])

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Memory Dashboard</h1>
          <p className="text-muted-foreground">
            Manage and explore your AI memory system
          </p>
        </div>

        {showUserSelector && (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <Input
              placeholder="User ID"
              value={currentUserId}
              onChange={(e) => setCurrentUserId(e.target.value)}
              className="w-40"
            />
          </div>
        )}
      </div>

      {memory.error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Error: {memory.error}</p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="memories" className="space-y-4">
        <TabsList>
          <TabsTrigger value="memories">Memories</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="memories" className="space-y-4">
          {/* Search and Filter Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search & Filter
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search memories..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full"
                  />
                </div>
                <Select
                  value={selectedCategory}
                  onValueChange={setSelectedCategory}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {MEMORY_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Memory
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Memory</DialogTitle>
                      <DialogDescription>
                        Create a new memory entry with content and metadata.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <Textarea
                        placeholder="Memory content..."
                        value={newMemoryContent}
                        onChange={(e) => setNewMemoryContent(e.target.value)}
                        rows={4}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label
                            htmlFor="category-select"
                            className="text-sm font-medium"
                          >
                            Category
                          </label>
                          <Select
                            value={newMemoryCategory}
                            onValueChange={setNewMemoryCategory}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {MEMORY_CATEGORIES.map((category) => (
                                <SelectItem key={category} value={category}>
                                  {category.charAt(0).toUpperCase() +
                                    category.slice(1)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label
                            htmlFor="tags-input"
                            className="text-sm font-medium"
                          >
                            Tags (comma-separated)
                          </label>
                          <Input
                            id="tags-input"
                            placeholder="tag1, tag2, tag3"
                            value={newMemoryTags}
                            onChange={(e) => setNewMemoryTags(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setNewMemoryContent('')
                          setNewMemoryCategory('general')
                          setNewMemoryTags('')
                        }}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleAddMemory}>Add Memory</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          {/* Memory List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Memories ({filteredMemories.length})
                </span>
                {memory.isLoading && (
                  <Badge variant="secondary">Loading...</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredMemories.length === 0 ? (
                <div className="text-center py-8">
                  <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {searchQuery
                      ? 'No memories found matching your search.'
                      : 'No memories found. Add your first memory!'}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Content</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMemories.map((mem) => (
                      <TableRow key={mem.id}>
                        <TableCell className="max-w-md">
                          <p className="truncate" title={mem.content}>
                            {mem.content}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {mem.metadata?.category || 'general'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {mem.metadata?.tags?.slice(0, 3).map((tag) => (
                              <Badge
                                key={tag}
                                variant="outline"
                                className="text-xs"
                              >
                                {tag}
                              </Badge>
                            ))}
                            {(mem.metadata?.tags?.length || 0) > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{(mem.metadata?.tags?.length || 0) - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatTimestamp(mem.metadata?.timestamp)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setEditingMemory(mem)
                                    setEditContent(mem.content)
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Edit Memory</DialogTitle>
                                  <DialogDescription>
                                    Update the content of this memory.
                                  </DialogDescription>
                                </DialogHeader>
                                <Textarea
                                  value={editContent}
                                  onChange={(e) =>
                                    setEditContent(e.target.value)
                                  }
                                  rows={4}
                                  placeholder="Memory content..."
                                />
                                <DialogFooter>
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setEditingMemory(null)
                                      setEditContent('')
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                  <Button onClick={handleEditMemory}>
                                    Save Changes
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Delete Memory
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this memory?
                                    This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() =>
                                      mem.id && handleDeleteMemory(mem.id)
                                    }
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          {memory.stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Memories
                  </CardTitle>
                  <Brain className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {memory.stats.totalMemories}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Categories
                  </CardTitle>
                  <Tag className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {Object.keys(memory.stats.categoryCounts).length}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Recent Activity
                  </CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {memory.stats.recentActivity.length}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {memory.stats && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Memory Distribution by Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(memory.stats.categoryCounts).map(
                    ([category, count]) => (
                      <div
                        key={category}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{category}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-secondary rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{
                                width: `${(count / (memory.stats?.totalMemories || 1)) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium">{count}</span>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="preferences" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Preferences</CardTitle>
              <CardDescription>
                Manage user-specific preferences stored in memory
              </CardDescription>
            </CardHeader>
            <CardContent>
              {userPrefs.memories.length === 0 ? (
                <p className="text-muted-foreground">No preferences found.</p>
              ) : (
                <div className="space-y-2">
                  {userPrefs.memories.map((pref) => (
                    <div
                      key={pref.id || pref.content}
                      className="flex items-center justify-between p-2 border rounded"
                    >
                      <span className="font-mono text-sm">{pref.content}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          pref.id && userPrefs.deleteMemory(pref.id)
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
