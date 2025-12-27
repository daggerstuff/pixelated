// Deprecated legacy route file. Modern routes live in projects.ts.
// Intentionally empty to avoid duplicate route definitions.
export { }
router.get('/', asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, category, status } = req.query
    const { user } = req as any

    const result = await listProjects(user.id, {
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 50,
        category: category as string,
        status: status as string
    })

    res.json({
        success: true,
        ...result
    })
}))

/**
 * GET /projects/:projectId
 * Get project details
 */
router.get('/:projectId', asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params
    const { user } = req as any

    const project = await getProject(projectId, user.id)

    res.json({
        success: true,
        data: project
    })
}))

/**
 * PUT /projects/:projectId
 * Update project details
 */
router.put('/:projectId', asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params
    const { name, description, category, budget, status } = req.body
    const { user } = req as any

    const project = await updateProject(projectId, user.id, {
        name,
        description,
        category,
        budget,
        status
    })

    res.json({
        success: true,
        data: project
    })
}))

/**
 * POST /projects/:projectId/objectives
 * Add objective to project
 */
router.post('/:projectId/objectives', asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params
    const { title, description, successCriteria, deadline } = req.body
    const { user } = req as any

    if (!title) {
        throw new ValidationError('Objective title is required', { title: true })
    }

    const project = await addObjective(projectId, user.id, {
        title,
        description,
        successCriteria,
        deadline: deadline ? new Date(deadline) : undefined
    })

    res.json({
        success: true,
        data: project
    })
}))

/**
 * POST /projects/:projectId/share
 * Share project with another user
 */
router.post('/:projectId/share', asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params
    const { userId, permissionLevel } = req.body
    const { user } = req as any

    if (!userId || !permissionLevel) {
        throw new ValidationError('userId and permissionLevel required', {
            userId: !userId,
            permissionLevel: !permissionLevel
        })
    }

    if (!['view', 'edit', 'comment'].includes(permissionLevel)) {
        throw new ValidationError('Invalid permission level', { permissionLevel: true })
    }

    const project = await shareProject(
        projectId,
        user.id,
        userId,
        permissionLevel as 'view' | 'edit' | 'comment'
    )

    res.json({
        success: true,
        data: project
    })
}))

/**
 * GET /projects/search/:query
 * Search projects
 */
router.get('/search/:query', asyncHandler(async (req: Request, res: Response) => {
    const { query } = req.params
    const { user } = req as any

    const results = await searchProjects(query, user.id)

    res.json({
        success: true,
        data: results
    })
}))

export default router
