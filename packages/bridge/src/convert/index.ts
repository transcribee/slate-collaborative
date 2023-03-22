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

const byAction: AAAA = {
  put: (patch: PutPatch) => {
    const key = patch.path[patch.path.length - 1]

    console.log('put', { patch, key })

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
  del: (patch: DelPatch) => {
    console.log('del', patch)

    return [
      {
        type: 'remove_node',
        node: { children: [] },
        path: toSlatePath(patch.path),
      } as RemoveNodeOperation
    ]
  },
  splice: (patch: SpliceTextPatch) => {
    console.log('splice', patch)
    throw new Error('not implemented')
  },
  inc: (patch: IncPatch) => {
    console.log('inc', patch)
    throw new Error('not implemented')
  },
  insert: (patch: InsertPatch) => {
    console.log('insert', { patch })

    const { path, values } = patch

    const key = patch.path[patch.path.length - 1]

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

    return values.map(value => ({
      type: 'insert_node',
      path: toSlatePath(path),
      node: {} as Node // do not add text or children property, since this is done by a separate patch
    }))
  }
};

type AAAA = {
  [Property in Patch['action']]: (
    patch: Patch & { action: Property }
  ) => Operation[]
}

type BBBB = (patch: Patch) => Operation[]

function pathsEqual(a: Path, b: Path) {
  return a.join(',') == b.join(',')
}

function mergeOps(insert: InsertNodeOperation, set: SetNodeOperation) {
  return {
    ...insert,
    node: {
      ...insert.node,
      ...set.newProperties
    }
  }
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

const toSlateOp = (patches: Patch[]) => {
  const operations = patches.flatMap(patch => {
    const action = byAction[patch.action] as BBBB
    return action(patch)
  })

  return optimizeOperations(operations)
}

export { toSlateOp }
