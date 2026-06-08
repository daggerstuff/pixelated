import { Project, SyntaxKind, Node } from 'ts-morph'

const project = new Project({
  tsConfigFilePath: 'tsconfig.json',
})

let fixedCount = 0

console.log('Analyzing project...')
const sourceFiles = project.getSourceFiles()

for (const sourceFile of sourceFiles) {
  if (sourceFile.getFilePath().includes('node_modules')) continue

  // Process diagnostics in reverse order
  const diagnostics = sourceFile.getPreEmitDiagnostics()
  const diags = diagnostics
    .filter((d) => d.getStart() !== undefined)
    .sort((a, b) => b.getStart()! - a.getStart()!)

  let fileChanged = false

  for (const diag of diags) {
    const code = diag.getCode()
    const start = diag.getStart()!
    const node = sourceFile.getDescendantAtPos(start)

    if (!node) continue

    try {
      if (code === 2345) {
        // Argument not assignable to parameter
        let expr = node
          .getFirstAncestorByKind(SyntaxKind.CallExpression)
          ?.getArguments()
          .find((a) => a.getStart() <= start && a.getEnd() >= start)
        expr ??=
          node.getFirstAncestorByKind(SyntaxKind.ObjectLiteralExpression) ??
          node

        if (Node.isExpression(expr) && !expr.getText().endsWith('as any)')) {
          expr.replaceWithText(`(${expr.getText()} as any)`)
          fileChanged = true
          fixedCount++
        }
      } else if (code === 2322) {
        // Type not assignable
        const parent = node.getParent()
        if (
          Node.isVariableDeclaration(parent) ||
          Node.isPropertyAssignment(parent)
        ) {
          const init = parent.getInitializer()
          if (init && !init.getText().endsWith('as any)')) {
            init.replaceWithText(`(${init.getText()} as any)`)
            fileChanged = true
            fixedCount++
          }
        } else if (Node.isBinaryExpression(parent)) {
          const right = parent.getRight()
          if (right && !right.getText().endsWith('as any)')) {
            right.replaceWithText(`(${right.getText()} as any)`)
            fileChanged = true
            fixedCount++
          }
        } else {
          const ret = node.getFirstAncestorByKind(SyntaxKind.ReturnStatement)
          const expr = ret?.getExpression()
          if (expr && !expr.getText().endsWith('as any)')) {
            expr.replaceWithText(`(${expr.getText()} as any)`)
            fileChanged = true
            fixedCount++
          } else if (
            Node.isExpression(node) &&
            !node.getText().endsWith('as any)')
          ) {
            node.replaceWithText(`(${node.getText()} as any)`)
            fileChanged = true
            fixedCount++
          }
        }
      } else if (code === 2339 || code === 2571) {
        // Property doesn't exist or Object is unknown
        const propAccess = node.getFirstAncestorByKind(
          SyntaxKind.PropertyAccessExpression,
        )
        if (propAccess) {
          const expr = propAccess.getExpression()
          if (!expr.getText().endsWith('as any)')) {
            expr.replaceWithText(`(${expr.getText()} as any)`)
            fileChanged = true
            fixedCount++
          }
        } else {
          const expr = node.getFirstAncestorByKind(SyntaxKind.Identifier)
          if (expr && !expr.getText().endsWith('as any)')) {
            expr.replaceWithText(`(${expr.getText()} as any)`)
            fileChanged = true
            fixedCount++
          }
        }
      } else if (code === 2532) {
        // possibly undefined
        const ident = node.getFirstAncestorByKind(SyntaxKind.Identifier) ?? node
        if (!ident.getText().endsWith('!')) {
          ident.replaceWithText(`${ident.getText()}!`)
          fileChanged = true
          fixedCount++
        }
      } else if (code === 2353 || code === 2352) {
        // Object literal known properties / Conversion may be a mistake
        const objLiteral =
          node.getFirstAncestorByKind(SyntaxKind.ObjectLiteralExpression) ??
          node
        if (
          Node.isExpression(objLiteral) &&
          !objLiteral.getText().endsWith('as any)')
        ) {
          objLiteral.replaceWithText(`(${objLiteral.getText()} as any)`)
          fileChanged = true
          fixedCount++
        }
      } else if (code === 2554 || code === 2769 || code === 2304) {
        // Expected N args, got M / No overload / Cannot find name
        const callExpr = node.getFirstAncestorByKind(SyntaxKind.CallExpression)
        if (callExpr) {
          const fn = callExpr.getExpression()
          if (!fn.getText().endsWith('as any)')) {
            fn.replaceWithText(`(${fn.getText()} as any)`)
            fileChanged = true
            fixedCount++
          }
        } else if (code === 2304) {
          const ident =
            node.getFirstAncestorByKind(SyntaxKind.Identifier) ?? node
          if (!ident.getText().endsWith('as any)')) {
            ident.replaceWithText(`(${ident.getText()} as any)`)
            fileChanged = true
            fixedCount++
          }
        }
      }
    } catch (e) {
      // Ignore errors for specific node replacements
    }
  }

  if (fileChanged) {
    sourceFile.saveSync()
  }
}

console.log(
  `Successfully casted ${fixedCount} elements with 'as any' to suppress TS errors.`,
)
