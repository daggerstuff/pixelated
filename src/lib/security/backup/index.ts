// ...

private async getDataForBackup(type: BackupType): Promise&lt;Uint8Array&gt; {
    const chunks: string[] = []
    chunks.push( '{"timestamp":"' + new Date().toISOString() + '","type":"' + type + '","data":{' )
    try {
        const mongooseModule = 'mongoose'
        const mongoose = (await import(/* @vite-ignore */ mongooseModule)).default ?? (await import(/* @vite-ignore */ mongooseModule))
        const models = mongoose.modelNames()
        let isFirstModel = true
        let baselineTime: Date | null = null
        if (type === BackupType.DIFFERENTIAL || type === BackupType.INCREMENTAL) {
            const requireFull = type === BackupType.DIFFERENTIAL
            const lastBackupTime = await this.getLastBackupTime(requireFull)
            baselineTime = lastBackupTime ?? new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
        for (const modelName of models) {
            const Model = mongoose.model(modelName)
            const query: Record&lt;string, unknown&gt; = {}
            if (baselineTime && Model.schema.paths.updatedAt) {
                query['updatedAt'] = { $gte: baselineTime }
            }
            if (!isFirstModel) {
                chunks.push(',')
            }
            const cursor = Model.find(query).lean().cursor()
            const docChunks: string[] = []
            let isFirstDoc = true
            let batchCount = 0
            for await (const doc of cursor) {
                if (!isFirstDoc) {
                    docChunks.push(',')
                }
                docChunks.push(JSON.stringify(doc))
                batchCount++
                if (batchCount >= 1000) {
                    chunks.push(docChunks.join(''))
                    docChunks.length = 0
                    batchCount = 0
                }
                isFirstDoc = false
            }
            if (docChunks.length > 0) {
                chunks.push(docChunks.join(''))
            }
            chunks.push(']')
            isFirstModel = false
        }
        chunks.push('}}')
    } catch (error: unknown) {
        logger.error(
            `Failed to collect data for backup: ${error instanceof Error ? (error instanceof Error ? error.message : 'Unknown error') : String(error)}`,
        )
        throw error // Fail loudly to prevent silent data corruption
    }
    return new TextEncoder().encode(chunks.join(''))
}

// ...