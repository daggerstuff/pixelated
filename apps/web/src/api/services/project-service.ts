import { v4 as uuid } from 'uuid'

// Projects Service Layer
import {
  getMongoConnection,
  getPostgresPool,
} from '../../lib/db/connection'
import { slug } from '../../utils/common'
import { NotFoundError, ForbiddenError } from '../middleware/error-handler'

type ProjectPermissions = {
  view: string[]
  edit: string[]
  comment: string[]
}

type ProjectObjective = {
  _id: string
  title: string
  description: string
  successCriteria: string[]
  deadline?: Date
  status: string
  progress: number
  createdAt: Date
  updatedAt: Date
}

type Project = {
  _id: string
  name: string
  slug: string
  description: string
  category: string
  owner: string
  stakeholders: string[]
  budget: number
  status: string
  objectives: ProjectObjective[]
  milestones: unknown[]
  permissions: ProjectPermissions
  createdAt: Date
  updatedAt: Date
  save: () => Promise<Project>
}

type ProjectListQuery = {
  page?: number
  limit?: number
  category?: string
  status?: string
}

type ProjectListResult = {
  data: Project[]
  pagination: {
    page: number
    limit: number
    total: number
  }
}

type ProjectQuery = Record<string, unknown>
type ProjectQueryChain = {
  limit: (limit: number) => ProjectQueryChain
  skip: (count: number) => ProjectQueryChain
  sort: (sort: { createdAt: -1 | 1 }) => Promise<Project[]>
}
type ProjectModelData = Omit<Project, 'save'>
type ProjectModel = {
  new (data: ProjectModelData): Project
  findById(id: string): Promise<Project | null>
  find(query: ProjectQuery): ProjectQueryChain
  countDocuments(query: ProjectQuery): Promise<number>
}

type ProjectUpdates = Partial<{
  name: string
  description: string
  category: string
  budget: number
  status: string
}>

type ObjectiveInput = {
  title: string
  description?: string
  successCriteria?: string[]
  deadline?: Date
}

function getProjectModel(): ProjectModel {
  return getMongoConnection().model<ProjectModelData, ProjectModel>('Project')
}

/**
 * Create a new project
 */
export async function createProject(data: {
  name: string
  description?: string
  category?: string
  ownerId: string
  stakeholders?: string[]
  budget?: number
}): Promise<Project> {
  const ProjectModel = getProjectModel()
  const pool = getPostgresPool()

  const projectId = uuid()
  const projectSlug = slug(data.name)

  const project = new ProjectModel({
    _id: projectId,
    name: data.name,
    slug: projectSlug,
    description: data.description ?? '',
    category: data.category ?? 'general',
    owner: data.ownerId,
    stakeholders: data.stakeholders ?? [data.ownerId],
    budget: data.budget ?? 0,
    status: 'active',
    objectives: [],
    milestones: [],
    permissions: {
      view: [data.ownerId],
      edit: [data.ownerId],
      comment: [data.ownerId],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  await project.save()

  // Record in PostgreSQL for relational queries
  await pool.query(
    `INSERT INTO projects (id, name, slug, description, owner_id, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [
      projectId,
      data.name,
      projectSlug,
      data.description ?? '',
      data.ownerId,
      'active',
    ],
  )

  return project
}

/**
 * Get project by ID with permission check
 */
export async function getProject(
  projectId: string,
  userId: string,
): Promise<Project> {
  const ProjectModel = getProjectModel()

  const project = await ProjectModel.findById(projectId)

  if (!project) {
    throw new NotFoundError('project', projectId)
  }

  // Check permissions
  if (!project.permissions.view.includes(userId) && project.owner !== userId) {
    throw new ForbiddenError('Cannot access this project')
  }

  return project
}

/**
 * Update project details
 */
export async function updateProject(
  projectId: string,
  userId: string,
  updates: ProjectUpdates,
): Promise<Project> {
  const ProjectModel = getProjectModel()
  const pool = getPostgresPool()

  const project = await ProjectModel.findById(projectId)

  if (!project) {
    throw new NotFoundError('project', projectId)
  }

  // Check edit permission
  if (!project.permissions.edit.includes(userId) && project.owner !== userId) {
    throw new ForbiddenError('Cannot edit this project')
  }

  const changes: Record<string, unknown> = {}

  if (updates.name !== undefined) {
    project.name = updates.name
    project.slug = slug(updates.name)
    changes['name'] = updates.name
  }

  if (updates.description !== undefined) {
    project.description = updates.description
    changes['description'] = updates.description
  }

  if (updates.category !== undefined) {
    project.category = updates.category
    changes['category'] = updates.category
  }

  if (updates.budget !== undefined) {
    project.budget = updates.budget
    changes['budget'] = updates.budget
  }

  if (updates.status !== undefined) {
    project.status = updates.status
    changes['status'] = updates.status
  }

  project.updatedAt = new Date()
  await project.save()

  // Update PostgreSQL
  if (Object.keys(changes).length > 0) {
    await pool.query(`UPDATE projects SET updated_at = NOW() WHERE id = $1`, [
      projectId,
    ])
  }

  return project
}

/**
 * Add objective to project
 */
export async function addObjective(
  projectId: string,
  userId: string,
  objective: ObjectiveInput,
): Promise<Project> {
  const ProjectModel = getProjectModel()

  const project = await ProjectModel.findById(projectId)

  if (!project) {
    throw new NotFoundError('project', projectId)
  }

  // Check edit permission
  if (!project.permissions.edit.includes(userId) && project.owner !== userId) {
    throw new ForbiddenError('Cannot edit this project')
  }

  const objectiveId = uuid()

  project.objectives.push({
    _id: objectiveId,
    title: objective.title,
    description: objective.description ?? '',
    successCriteria: objective.successCriteria ?? [],
    deadline: objective.deadline,
    status: 'active',
    progress: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  project.updatedAt = new Date()
  await project.save()

  return project
}

/**
 * List projects for user
 */
export async function listProjects(
  userId: string,
  options: ProjectListQuery = {},
): Promise<ProjectListResult> {
  const ProjectModel = getProjectModel()
  const page = options.page ?? 1
  const limit = options.limit ?? 50
  const skip = (page - 1) * limit

  const query: ProjectQuery = {
    $or: [{ owner: userId }, { 'permissions.view': userId }],
  }

  if (options.category) {
    query['category'] = options.category
  }

  if (options.status) {
    query['status'] = options.status
  }

  const projects = await ProjectModel.find(query)
    .limit(limit)
    .skip(skip)
    .sort({ createdAt: -1 })

  const total = await ProjectModel.countDocuments(query)

  return {
    data: projects,
    pagination: { page, limit, total },
  }
}

/**
 * Search projects
 */
export async function searchProjects(
  query: string,
  userId: string,
  limit: number = 50,
): Promise<Project[]> {
  const ProjectModel = getProjectModel()

  const queryResult = ProjectModel.find({
    $text: { $search: query },
    $or: [{ owner: userId }, { 'permissions.view': userId }],
  })
  let limitedResult: unknown

  if (
    typeof (queryResult as unknown as { limit?: unknown }).limit === 'function'
  ) {
    const limited = (
      queryResult as unknown as {
        limit: (limit: number) => Promise<Project[]> | Project[]
      }
    ).limit(limit)
    limitedResult =
      typeof (limited as unknown as { sort?: unknown }).sort === 'function'
        ? await (
            limited as unknown as {
              sort: (sort: {
                createdAt: -1 | 1
              }) => Promise<Project[]> | Project[]
            }
          ).sort({ createdAt: -1 })
        : limited
  } else {
    limitedResult = queryResult
  }

  return (Array.isArray(limitedResult) ? limitedResult : []) as Project[]
}

/**
 * Share project with another user
 */
export async function shareProject(
  projectId: string,
  ownerId: string,
  targetUserId: string,
  permissionLevel: 'view' | 'edit' | 'comment',
): Promise<Project> {
  const ProjectModel = getProjectModel()

  const project = await ProjectModel.findById(projectId)

  if (!project) {
    throw new NotFoundError('project', projectId)
  }

  // Check ownership
  if (project.owner !== ownerId) {
    throw new ForbiddenError('Only project owner can share')
  }

  // Add to appropriate permission array
  const permissionKey = permissionLevel
  if (!project.permissions[permissionKey].includes(targetUserId)) {
    project.permissions[permissionKey].push(targetUserId)
    await project.save()
  }

  return project
}
