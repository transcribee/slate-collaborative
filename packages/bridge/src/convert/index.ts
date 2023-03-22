import * as Automerge from '@automerge/automerge'

// import opInsert from './insert.xts'
// import opRemove from './remove.xts'
// import opSet from './set.xts'
import opCreate from './create'

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

    console.log('put', { patch, key })

    // update tmpDoc
    const element = getChild(tmpDoc, parentPath(patch.path))
    element[key] = patch.value

    // update insert operation if it exists
    if (element._insertOp) {
      (element._insertOp as InsertNodeOperation).node[key] = patch.value
      return []
    }

    // generate slate op
    return [
      {
        type: 'set_node',
        path: toSlatePath(patch.path),
        properties: {}, // used to track removed keys, should not apply for put patches
        newProperties: {
          [key]: patch.value
        }
      }
    ]
  },
  del: (patch: DelPatch, tmpDoc: unknown) => {
    console.log('del', patch)

    return [
      {
        type: 'remove_node',
        node: { children: [] },
        path: toSlatePath(patch.path)
      } as RemoveNodeOperation
    ]
  },
  splice: (patch: SpliceTextPatch, tmpDoc: unknown) => {
    console.log('splice', patch)
    throw new Error('not implemented')
  },
  inc: (patch: IncPatch, tmpDoc: unknown) => {
    console.log('inc', patch)
    throw new Error('not implemented')
  },
  insert: (patch: InsertPatch, tmpDoc: unknown, opsToClean: any[]) => {
    console.log('insert', { patch })

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

    const insertOps = values.map((value, idx) => ({
      type: 'insert_node',
      path: [...parentPath(toSlatePath(path)), (key as number) + idx],
      node: {} as Node // do not add text or children property, since this is done by a separate patch
    } as InsertNodeOperation))

    insertOps.forEach((op, idx) => {
      ;(getChild(tmpDoc, parentPath(patch.path)) as any[]).splice(
        key as number + idx,
        0,
        { _insertOp: op }
      )
    })

    return insertOps;
  }
}

type AAAA = {
  [Property in Patch['action']]: (
    patch: Patch & { action: Property },
    tmpDoc: unknown,
    opsToClean: any[],
  ) => Operation[]
}

type BBBB = (patch: Patch, tmpDoc: unknown, opsToClean: any[],) => Operation[]

function pathsEqual(a: Path, b: Path) {
  return a.join(',') == b.join(',')
}

function optimizeOperations(ops: Operation[]) {
  if (ops.length == 0) return []

  const optimizedOperations: Operation[] = []

  ops.forEach((op, idx) => {
    if (idx === 0) {
      optimizedOperations.push(op)
      return
    }

    const last = optimizedOperations[optimizedOperations.length - 1]

    if (last.type === 'insert_node') {
      if (op.type === 'set_node' && pathsEqual(op.path, last.path)) {
        optimizedOperations[optimizedOperations.length - 1] = {
          ...last,
          node: {
            ...last.node,
            ...op.newProperties
          }
        }
        return
      }

      if (
        op.type === 'insert_text' &&
        pathsEqual(op.path, last.path) &&
        Text.isText(last.node) &&
        last.node.text == ''
      ) {
        optimizedOperations[optimizedOperations.length - 1] = {
          ...last,
          node: {
            ...last.node,
            text: op.text
          }
        }
        return
      }
    }

    optimizedOperations.push(op)
  })

  return optimizedOperations
}

function cleanupOperations(ops: any[]) {
  ops.forEach(op => {
    if (op._insertOp) {
      op._insertOp.type = "_"
      delete op._insertOp
    }

    if (op.node?.children) {
      cleanupOperations(op.node.children);
    }
  });
}



const toSlateOp = (patches: Patch[], before: Automerge.Doc<unknown>) => {
  const tmpDoc = toJS(before)
  const opsToClean: any[] = []

  const operations = patches.flatMap(patch => {
    const action = byAction[patch.action] as BBBB
    return action(patch, tmpDoc, opsToClean)
  })

  cleanupOperations(operations);

  return operations.filter(op => op.type as any != '_')
}

export { toSlateOp }
