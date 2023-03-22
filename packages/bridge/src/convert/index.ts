import * as Automerge from '@automerge/automerge'

import { toJS, toSlatePath } from '../utils'

import {
  DelPatch,
  IncPatch,
  InsertPatch,
  Patch,
  PutPatch,
  SpliceTextPatch
} from '@automerge/automerge'
import {
  Operation,
  Node,
  Path,
  InsertTextOperation,
  InsertNodeOperation,
  SetNodeOperation,
  Text,
  RemoveNodeOperation
} from 'slate'

const parentPath = (path: any[]) => path.slice(0, -1)

function getChild(tree: any, path: (string | number)[]) {
  let current = tree

  path.forEach(part => {
    current = current[part]
  })

  return current
}

const byAction: AAAA = {
  put: (patch: PutPatch, tmpDoc: unknown) => {
    const key = patch.path[patch.path.length - 1]

    // update tmpDoc
    const element = getChild(tmpDoc, parentPath(patch.path))
    if (element !== undefined) {
      element[key] =
        typeof element[key] === 'object' && typeof patch.value === 'object'
          ? { ...element[key], ...patch.value }
          : patch.value
    }

    // update insert operation if it exists
    if (element._insertOp) {
      ;(element._insertOp as InsertNodeOperation).node[key] = patch.value
      return []
    }

    // generate slate op
    return [
      {
        type: 'set_node',
        path: toSlatePath(parentPath(patch.path)),
        properties: {}, // used to track removed keys, should not apply for put patches
        newProperties: {
          [key]: patch.value
        }
      }
    ]
  },
  del: (patch: DelPatch, tmpDoc: unknown) => {
    return [
      {
        type: 'remove_node',
        node: { children: [] },
        path: toSlatePath(patch.path)
      } as RemoveNodeOperation
    ]
  },
  splice: (patch: SpliceTextPatch, tmpDoc: unknown) => {
    throw new Error('not implemented')
  },
  inc: (patch: IncPatch, tmpDoc: unknown) => {
    throw new Error('not implemented')
  },
  insert: (patch: InsertPatch, tmpDoc: unknown) => {
    const { path, values } = patch

    const key = path[path.length - 1]

    if (typeof patch.values[0] === 'string') {
      return [
        {
          type: 'insert_text',
          text: patch.values.join(''),
          path: toSlatePath(parentPath(patch.path)),
          offset: key
        } as InsertTextOperation
      ]
    }

    const insertOps = values.map(
      (value, idx) =>
        ({
          type: 'insert_node',
          path: [...parentPath(toSlatePath(path)), (key as number) + idx],
          node: {} as Node // do not add text or children property, since this is done by a separate patch
        } as InsertNodeOperation)
    )

    getChild(tmpDoc, parentPath(patch.path)).splice(
      key as number,
      0,
      ...insertOps.map(op => ({ _insertOp: op }))
    )

    return insertOps
  }
}

type AAAA = {
  [Property in Patch['action']]: (
    patch: Patch & { action: Property },
    tmpDoc: unknown
  ) => Operation[]
}

type BBBB = (patch: Patch, tmpDoc: unknown) => Operation[]

function cleanupOperations(ops: any[]) {
  ops.forEach(op => {
    if (op._insertOp) {
      op._insertOp.type = '_'
      delete op._insertOp
    }

    if (op.node?.children) {
      cleanupOperations(op.node.children)
    }
  })
}

const toSlateOp = (patches: Patch[], before: Automerge.Doc<unknown>) => {
  const tmpDoc = toJS(before)

  const operations = patches.flatMap(patch => {
    const action = byAction[patch.action] as BBBB
    const ops = action(patch, tmpDoc)
    return ops;
  })

  cleanupOperations(operations)

  return operations.filter(op => (op.type as any) != '_')
}

export { toSlateOp }
