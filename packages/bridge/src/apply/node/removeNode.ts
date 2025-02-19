import { RemoveNodeOperation } from 'slate'

import { SyncValue } from '../../model'
import { getChildren, getParentFromDoc } from '../../path'

export const removeNode = (
  doc: SyncValue,
  op: RemoveNodeOperation
): SyncValue => {
  const [parent, index] = getParentFromDoc(doc, op.path)

  if (parent.text) {
    throw new TypeError("Can't remove node from text node")
  }

  getChildren(parent).splice(index, 1)

  return doc
}

export default removeNode
